package com.ecommerce.hardware.service;

import com.ecommerce.hardware.config.StripeProperties;
import com.ecommerce.hardware.model.PurchaseOrder;
import com.stripe.StripeClient;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.model.StripeCollection;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.RefundListParams;
import com.stripe.param.checkout.SessionCreateParams;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/** Server-only adapter for Stripe Checkout. Payment credentials never pass through this application. */
@Service
public class StripePaymentGateway {
    private static final Logger LOG = LoggerFactory.getLogger(StripePaymentGateway.class);
    private static final String CURRENCY = "brl";
    private static final String INTEGRATION_MARKER = "nexus_checkout_v1";

    private final StripeProperties properties;
    private final ObjectMapper objectMapper = JsonMapper.shared();
    private volatile StripeClient stripeClient;

    public StripePaymentGateway(StripeProperties properties) {
        this.properties = properties;
    }

    /** Generates every time-sensitive/provider parameter once, before the order transaction commits. */
    public CheckoutConfiguration checkoutConfiguration(Long orderId) {
        requireCheckoutConfiguration();
        int minutes = Math.min(1_440, validExpirationMinutes() + 2);
        long pixSeconds = Math.max(10L, Math.min(1_209_600L, properties.getPixExpiresMinutes() * 60L));
        long boletoDays = Math.max(0L, Math.min(60L, properties.getBoletoExpiresDays()));
        return new CheckoutConfiguration(Instant.now().plus(minutes, ChronoUnit.MINUTES), successUrl(),
                withQuery(properties.getCancelUrl().trim(), "order_id", orderId.toString()),
                pixSeconds, boletoDays);
    }

    public CheckoutSession createCheckout(PurchaseOrder order, List<CheckoutItem> items, String idempotencyKey) {
        requireStoredCheckoutConfiguration(order);
        SessionCreateParams.Builder params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSubmitType(SessionCreateParams.SubmitType.PAY)
                .setBillingAddressCollection(SessionCreateParams.BillingAddressCollection.REQUIRED)
                .setClientReferenceId(order.getExternalReference())
                .setCustomerEmail(order.getEmail())
                .setSuccessUrl(order.getProviderSuccessUrl())
                .setCancelUrl(order.getProviderCancelUrl())
                .setExpiresAt(order.getCheckoutExpiresAt().getEpochSecond())
                .putMetadata("order_id", order.getId().toString())
                .putMetadata("order_reference", order.getExternalReference())
                .putMetadata("integration", INTEGRATION_MARKER)
                .setPaymentIntentData(SessionCreateParams.PaymentIntentData.builder()
                        .setReceiptEmail(order.getEmail())
                        .putMetadata("order_id", order.getId().toString())
                        .putMetadata("order_reference", order.getExternalReference())
                        .putMetadata("integration", INTEGRATION_MARKER)
                        .build())
                .addPaymentMethodType(paymentMethod(order.getPaymentMethod()));

        applyPaymentMethodExpiration(params, order);
        for (CheckoutItem item : items) {
            SessionCreateParams.LineItem.PriceData.ProductData.Builder product =
                    SessionCreateParams.LineItem.PriceData.ProductData.builder()
                            .setName(truncate(item.productName(), 255))
                            .putMetadata("product_id", item.productId().toString());
            if (isHttps(item.imageUrl())) product.addImage(item.imageUrl());
            params.addLineItem(SessionCreateParams.LineItem.builder()
                    .setQuantity(item.quantity().longValue())
                    .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency(CURRENCY)
                            .setUnitAmount(toMinorUnits(item.unitPrice()))
                            .setProductData(product.build())
                            .build())
                    .build());
        }

        try {
            Session session = client().checkout().sessions().create(params.build(), requestOptions(idempotencyKey));
            if (session.getId() == null || session.getUrl() == null || !isHttps(session.getUrl())) {
                throw new GatewayOperationException("O provedor retornou uma sessão de pagamento inválida.",
                        true, null);
            }
            return new CheckoutSession(session.getId(), session.getUrl(), session.getPaymentIntent());
        } catch (StripeException exception) {
            logStripeFailure("create_checkout", exception);
            throw new GatewayOperationException("Não foi possível iniciar o pagamento seguro.",
                    isIndeterminate(exception), exception);
        }
    }

    public void expireCheckout(String checkoutSessionId, String idempotencyKey) {
        requireIdentifier(checkoutSessionId, "cs_");
        try {
            client().checkout().sessions().expire(checkoutSessionId, requestOptions(idempotencyKey));
        } catch (StripeException exception) {
            logStripeFailure("expire_checkout", exception);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Este checkout não pode mais ser cancelado. Atualize o status do pedido.");
        }
    }

    public RefundResult refund(String paymentIntentId, long amount, String orderReference,
                               String refundAttemptId, String idempotencyKey) {
        requireIdentifier(paymentIntentId, "pi_");
        try {
            Refund refund = client().refunds().create(RefundCreateParams.builder()
                    .setPaymentIntent(paymentIntentId)
                    .setAmount(amount)
                    .setReason(RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER)
                    .putMetadata("order_reference", orderReference)
                    .putMetadata("refund_attempt_id", refundAttemptId)
                    .putMetadata("integration", INTEGRATION_MARKER)
                    .build(), requestOptions(idempotencyKey));
            if (refund.getId() == null || !refund.getId().matches("re_[A-Za-z0-9_]{8,250}")) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "O provedor retornou um reembolso inválido.");
            }
            return refundResult(refund);
        } catch (StripeException exception) {
            logStripeFailure("create_refund", exception);
            throw new GatewayOperationException("O provedor não conseguiu iniciar o reembolso.",
                    isIndeterminate(exception), exception);
        }
    }

    public RefundResult retrieveRefund(String refundId) {
        requireIdentifier(refundId, "re_");
        try {
            Refund refund = client().refunds().retrieve(refundId);
            return refundResult(refund);
        } catch (StripeException exception) {
            logStripeFailure("retrieve_refund", exception);
            throw new GatewayOperationException("Não foi possível reconciliar o reembolso no provedor.",
                    isIndeterminate(exception), exception);
        }
    }

    public List<RefundResult> listRefunds(String paymentIntentId) {
        requireIdentifier(paymentIntentId, "pi_");
        List<RefundResult> results = new ArrayList<>();
        String startingAfter = null;
        try {
            while (true) {
                RefundListParams.Builder params = RefundListParams.builder()
                        .setPaymentIntent(paymentIntentId)
                        .setLimit(100L);
                if (startingAfter != null) params.setStartingAfter(startingAfter);
                StripeCollection<Refund> page = client().refunds().list(params.build());
                List<Refund> data = page == null ? null : page.getData();
                if (data != null) data.forEach(refund -> results.add(refundResult(refund)));
                if (page == null || !Boolean.TRUE.equals(page.getHasMore())) break;
                if (data == null || data.isEmpty()) {
                    throw new GatewayOperationException(
                            "O provedor retornou uma paginação de reembolsos inválida.", false, null);
                }
                String next = data.get(data.size() - 1).getId();
                if (next == null || next.equals(startingAfter)) {
                    throw new GatewayOperationException(
                            "O provedor retornou uma paginação de reembolsos inválida.", false, null);
                }
                startingAfter = next;
            }
            return List.copyOf(results);
        } catch (StripeException exception) {
            logStripeFailure("list_refunds", exception);
            throw new GatewayOperationException("Não foi possível reconciliar os reembolsos no provedor.",
                    isIndeterminate(exception), exception);
        }
    }

    public CheckoutSnapshot retrieveCheckout(String checkoutSessionId) {
        requireIdentifier(checkoutSessionId, "cs_");
        try {
            Session session = client().checkout().sessions().retrieve(checkoutSessionId);
            Map<String, String> metadata = session.getMetadata();
            return new CheckoutSnapshot(session.getId(), session.getClientReferenceId(), session.getPaymentIntent(),
                    session.getPaymentStatus(), session.getStatus(), session.getCurrency(), session.getAmountTotal(),
                    metadata == null ? null : metadata.get("order_reference"),
                    metadata == null ? null : metadata.get("integration"));
        } catch (StripeException exception) {
            logStripeFailure("retrieve_checkout", exception);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Não foi possível reconciliar o checkout no provedor.");
        }
    }

    public PaymentIntentSnapshot retrievePaymentIntent(String paymentIntentId) {
        requireIdentifier(paymentIntentId, "pi_");
        try {
            PaymentIntent intent = client().paymentIntents().retrieve(paymentIntentId);
            Map<String, String> metadata = intent.getMetadata();
            Long received = intent.getAmountReceived();
            return new PaymentIntentSnapshot(intent.getId(), intent.getStatus(), intent.getCurrency(),
                    received == null || received == 0 ? intent.getAmount() : received,
                    metadata == null ? null : metadata.get("order_reference"),
                    metadata == null ? null : metadata.get("integration"));
        } catch (StripeException exception) {
            logStripeFailure("retrieve_payment_intent", exception);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Não foi possível reconciliar o pagamento no provedor.");
        }
    }

    public VerifiedWebhookEvent verifyWebhook(String payload, String signature) {
        requireWebhookConfiguration();
        if (payload == null || payload.isBlank() || signature == null || signature.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook inválido.");
        }
        try {
            Event verified = Webhook.constructEvent(payload, signature, properties.getWebhookSecret().trim());
            JsonNode root = objectMapper.readTree(payload);
            validateWebhookEnvironment(root);
            JsonNode object = root.path("data").path("object");
            return new VerifiedWebhookEvent(
                    verified.getId(), verified.getType(), verified.getCreated(), text(object, "id"),
                    checkoutSessionId(verified.getType(), object), text(object, "client_reference_id"),
                    paymentIntentId(verified.getType(), object), text(object, "payment_status"),
                    text(object, "status"), text(object, "currency"), eventAmount(verified.getType(), object),
                    number(object, "amount_refunded"), failureCode(object),
                    metadata(object, "order_reference"), metadata(object, "refund_attempt_id"),
                    metadata(object, "integration"));
        } catch (SignatureVerificationException | RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assinatura do webhook inválida.");
        }
    }

    private StripeClient client() {
        requireApiKey();
        StripeClient current = stripeClient;
        if (current == null) {
            synchronized (this) {
                current = stripeClient;
                if (current == null) {
                    current = StripeClient.builder()
                            .setApiKey(properties.getSecretKey().trim())
                            .setConnectTimeout(10_000)
                            .setReadTimeout(20_000)
                            .setMaxNetworkRetries(2)
                            .build();
                    stripeClient = current;
                }
            }
        }
        return current;
    }

    private void requireApiKey() {
        if (properties.getSecretKey() == null || properties.getSecretKey().isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Gateway de pagamento ainda não foi configurado.");
        }
        String key = properties.getSecretKey().trim();
        boolean liveKey = key.startsWith("sk_live_") || key.startsWith("rk_live_");
        boolean testKey = key.startsWith("sk_test_") || key.startsWith("rk_test_");
        if (!liveKey && !testKey || liveKey != properties.isLiveMode()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "A chave do gateway não corresponde ao modo Stripe configurado.");
        }
    }

    private void requireCheckoutConfiguration() {
        requireApiKey();
        if (!isAllowedReturnUrl(properties.getSuccessUrl()) || !isAllowedReturnUrl(properties.getCancelUrl())) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "URLs de retorno do pagamento ainda não foram configuradas.");
        }
    }

    private void requireStoredCheckoutConfiguration(PurchaseOrder order) {
        requireApiKey();
        if (order.getCheckoutExpiresAt() == null || !isAllowedReturnUrl(order.getProviderSuccessUrl())
                || !isAllowedReturnUrl(order.getProviderCancelUrl())) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Os parâmetros persistidos do checkout estão incompletos.");
        }
    }

    private void requireWebhookConfiguration() {
        if (properties.getWebhookSecret() == null || properties.getWebhookSecret().isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Webhook de pagamento ainda não foi configurado.");
        }
    }

    private void validateWebhookEnvironment(JsonNode root) {
        if (!root.path("livemode").isBoolean()
                || root.path("livemode").asBoolean() != properties.isLiveMode()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "O modo do webhook não corresponde ao ambiente configurado.");
        }
    }

    private RequestOptions requestOptions(String idempotencyKey) {
        return RequestOptions.builder().setIdempotencyKey(idempotencyKey).build();
    }

    private String successUrl() {
        String configured = properties.getSuccessUrl().trim();
        return configured.contains("{CHECKOUT_SESSION_ID}")
                ? configured : withQuery(configured, "session_id", "{CHECKOUT_SESSION_ID}");
    }

    private int validExpirationMinutes() {
        return Math.max(30, Math.min(1_440, properties.getCheckoutExpiresMinutes()));
    }

    private static void applyPaymentMethodExpiration(SessionCreateParams.Builder params, PurchaseOrder order) {
        SessionCreateParams.PaymentMethodOptions.Builder options = SessionCreateParams.PaymentMethodOptions.builder();
        if ("PIX".equals(order.getPaymentMethod())) {
            params.setPaymentMethodOptions(options.setPix(SessionCreateParams.PaymentMethodOptions.Pix.builder()
                    .setExpiresAfterSeconds(order.getPixExpiresSeconds()).build()).build());
        } else if ("BOLETO".equals(order.getPaymentMethod())) {
            params.setPaymentMethodOptions(options.setBoleto(SessionCreateParams.PaymentMethodOptions.Boleto.builder()
                    .setExpiresAfterDays(order.getBoletoExpiresDays()).build()).build());
        }
    }

    private static SessionCreateParams.PaymentMethodType paymentMethod(String method) {
        return switch (method) {
            case "PIX" -> SessionCreateParams.PaymentMethodType.PIX;
            case "BOLETO" -> SessionCreateParams.PaymentMethodType.BOLETO;
            case "CARTAO_CREDITO" -> SessionCreateParams.PaymentMethodType.CARD;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Forma de pagamento não suportada.");
        };
    }

    public static long toMinorUnits(BigDecimal value) {
        try {
            return value.setScale(2, RoundingMode.UNNECESSARY).movePointRight(2).longValueExact();
        } catch (ArithmeticException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valor monetário inválido.");
        }
    }

    private static boolean isAllowedReturnUrl(String value) {
        if (value == null || value.isBlank()) return false;
        try {
            URI uri = URI.create(value.trim().replace("{CHECKOUT_SESSION_ID}", "cs_test_placeholder"));
            if (uri.getFragment() != null || uri.getHost() == null) return false;
            return "https".equalsIgnoreCase(uri.getScheme())
                    || ("http".equalsIgnoreCase(uri.getScheme())
                    && ("localhost".equalsIgnoreCase(uri.getHost()) || "127.0.0.1".equals(uri.getHost())));
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private static boolean isHttps(String value) {
        try {
            return value != null && "https".equalsIgnoreCase(URI.create(value).getScheme());
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private static String withQuery(String url, String name, String value) {
        return url + (url.contains("?") ? "&" : "?") + name + "=" + value;
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static void requireIdentifier(String value, String prefix) {
        if (value == null || !value.matches(prefix + "[A-Za-z0-9_]{8,250}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Identificador de pagamento inválido.");
        }
    }

    private static boolean isIndeterminate(StripeException exception) {
        Integer status = exception.getStatusCode();
        return status == null || status == 409 || status == 429 || status >= 500;
    }

    private static String checkoutSessionId(String eventType, JsonNode object) {
        return eventType != null && eventType.startsWith("checkout.session.") ? text(object, "id") : null;
    }

    private static String expandableId(JsonNode object, String name) {
        JsonNode value = object.path(name);
        if (value.isTextual()) return value.asText();
        return value.isObject() ? text(value, "id") : null;
    }

    private static String paymentIntentId(String eventType, JsonNode object) {
        if (eventType != null && eventType.startsWith("payment_intent.")) return text(object, "id");
        return expandableId(object, "payment_intent");
    }

    private static Long eventAmount(String eventType, JsonNode object) {
        if (eventType != null && eventType.startsWith("checkout.session.")) return number(object, "amount_total");
        if (eventType != null && eventType.startsWith("payment_intent.")) {
            Long received = number(object, "amount_received");
            return received == null || received == 0 ? number(object, "amount") : received;
        }
        return number(object, "amount");
    }

    private static Long number(JsonNode object, String name) {
        JsonNode value = object.path(name);
        return value.isIntegralNumber() ? value.asLong() : null;
    }

    private static String metadata(JsonNode object, String name) {
        return text(object.path("metadata"), name);
    }

    private static RefundResult refundResult(Refund refund) {
        Map<String, String> metadata = refund.getMetadata();
        return new RefundResult(refund.getId(), refund.getStatus(), refund.getAmount(), refund.getCurrency(),
                refund.getCreated(), refund.getPaymentIntent(),
                metadata == null ? null : metadata.get("order_reference"),
                metadata == null ? null : metadata.get("refund_attempt_id"),
                metadata == null ? null : metadata.get("integration"));
    }

    private static String failureCode(JsonNode object) {
        String direct = text(object, "failure_reason");
        if (direct != null) return direct;
        return text(object.path("last_payment_error"), "code");
    }

    private static String text(JsonNode object, String name) {
        JsonNode value = object.path(name);
        return value.isTextual() ? value.asText() : null;
    }

    private static void logStripeFailure(String operation, StripeException exception) {
        LOG.error("Stripe operation failed: operation={} requestId={} code={} status={}", operation,
                safe(exception.getRequestId()), safe(exception.getCode()), exception.getStatusCode());
    }

    private static String safe(String value) {
        if (value == null) return "none";
        return value.replaceAll("[^A-Za-z0-9_.-]", "_").toLowerCase(Locale.ROOT);
    }

    public record CheckoutConfiguration(Instant expiresAt, String successUrl, String cancelUrl,
                                        Long pixExpiresSeconds, Long boletoExpiresDays) { }
    public record CheckoutItem(Long productId, String productName, Integer quantity,
                               BigDecimal unitPrice, String imageUrl) { }
    public record CheckoutSession(String id, String url, String paymentIntentId) { }
    public record CheckoutSnapshot(String id, String externalReference, String paymentIntentId,
                                   String paymentStatus, String status, String currency, Long amountTotal,
                                   String metadataOrderReference, String integration) { }
    public record PaymentIntentSnapshot(String id, String status, String currency, Long amount,
                                        String metadataOrderReference, String integration) { }
    public record RefundResult(String id, String status, Long amount, String currency, Long created,
                               String paymentIntentId, String metadataOrderReference,
                               String metadataRefundAttemptId, String integration) {
        public RefundResult(String id, String status, Long amount, String currency, Long created) {
            this(id, status, amount, currency, created, null, null, null, null);
        }
    }
    public record VerifiedWebhookEvent(String id, String type, Long created, String objectId,
                                       String checkoutSessionId, String externalReference, String paymentIntentId,
                                       String paymentStatus, String objectStatus, String currency, Long amountTotal,
                                       Long amountRefunded, String failureCode, String metadataOrderReference,
                                       String metadataRefundAttemptId, String integration) { }

    public static final class GatewayOperationException extends ResponseStatusException {
        private final boolean indeterminate;

        GatewayOperationException(String reason, boolean indeterminate, Throwable cause) {
            super(HttpStatus.BAD_GATEWAY, reason, cause);
            this.indeterminate = indeterminate;
        }

        public boolean isIndeterminate() { return indeterminate; }
    }
}
