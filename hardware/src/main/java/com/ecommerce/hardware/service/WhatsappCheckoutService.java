package com.ecommerce.hardware.service;

import com.ecommerce.hardware.config.StoreProperties;
import com.ecommerce.hardware.model.CustomerAccount;
import com.ecommerce.hardware.model.InventoryStatus;
import com.ecommerce.hardware.model.PaymentCheckoutAttempt;
import com.ecommerce.hardware.model.PaymentProvider;
import com.ecommerce.hardware.model.PaymentState;
import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.model.PurchaseOrderItem;
import com.ecommerce.hardware.repository.PaymentCheckoutAttemptRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import com.ecommerce.hardware.service.PaymentService.CheckoutConflictException;
import com.ecommerce.hardware.service.PaymentService.CheckoutCustomer;
import com.ecommerce.hardware.service.PaymentService.CheckoutPersistenceIntent;
import com.ecommerce.hardware.service.PaymentService.RequestedItem;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Handles the WHATSAPP payment provider flow:
 * <ol>
 *   <li>Validates the store-level WhatsApp number before every checkout.</li>
 *   <li>Creates the order, reserves inventory, and stores the validated wa.me URL — all in one transaction.</li>
 *   <li>Reuses the idempotency infrastructure ({@link PaymentCheckoutAttempt}) so replay requests
 *       return the same order and URL without creating duplicates or double-reserving stock.</li>
 *   <li>Schedules expiration of unconfirmed WHATSAPP orders so reserved stock is never
 *       abandoned indefinitely.</li>
 * </ol>
 *
 * <p><strong>PII policy (requirement 3):</strong> the WhatsApp message contains <em>only</em> the
 * order id and the total in Brazilian Real. No name, CPF, e-mail, address, or product details
 * are included in the message or in any part of the wa.me URL.
 */
@Service
public class WhatsappCheckoutService {

    private static final Logger LOG = LoggerFactory.getLogger(WhatsappCheckoutService.class);
    private static final String WA_ME_HOST = "wa.me";
    private static final String WA_ME_SCHEME = "https";

    private final StoreProperties storeProperties;
    private final ProductRepository products;
    private final PurchaseOrderRepository orders;
    private final PaymentCheckoutAttemptRepository checkoutAttempts;
    private final TransactionTemplate transactions;

    public WhatsappCheckoutService(StoreProperties storeProperties,
                                   ProductRepository products,
                                   PurchaseOrderRepository orders,
                                   PaymentCheckoutAttemptRepository checkoutAttempts,
                                   PlatformTransactionManager transactionManager) {
        this.storeProperties = storeProperties;
        this.products = products;
        this.orders = orders;
        this.checkoutAttempts = checkoutAttempts;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    // ── Public API ──────────────────────────────────────────────────────────────

    /**
     * Creates a WHATSAPP order (or replays an existing idempotent one) and returns
     * the order id plus a validated wa.me redirect URL.
     *
     * @throws ResponseStatusException 503 if {@code APP_STORE_WHATSAPP_NUMBER} is absent or invalid
     * @throws ResponseStatusException 409 on idempotency conflict (different payload, same key)
     * @throws ResponseStatusException 422 on insufficient stock
     */
    public WhatsappCheckoutResult startCheckout(CustomerAccount customer,
                                                CheckoutCustomer checkoutCustomer,
                                                List<RequestedItem> requestedItems,
                                                String idempotencyKey,
                                                CheckoutPersistenceIntent persistenceIntent,
                                                Runnable persistAcceptedCheckout) {
        // Fail fast — do not create any order or reserve any stock if the number is not configured.
        validateWhatsappNumber();

        Map<Long, Integer> quantities = aggregate(requestedItems);
        CheckoutPersistenceIntent intent =
                persistenceIntent == null ? CheckoutPersistenceIntent.none() : persistenceIntent;
        Runnable persistence = Objects.requireNonNull(persistAcceptedCheckout, "persistAcceptedCheckout");
        String requestHash = checkoutRequestHash(checkoutCustomer, quantities, intent);

        ensureCheckoutAttempt(idempotencyKey, customer.getId(), requestHash);

        return Objects.requireNonNull(
                transactions.execute(ignored ->
                        doStartCheckout(customer, checkoutCustomer, requestedItems, quantities,
                                idempotencyKey, requestHash, persistence)),
                "WhatsApp checkout transaction returned null");
    }

    /**
     * Manually confirms that payment was received for a WHATSAPP order (admin action).
     * Records a full capture equal to the order total, commits inventory, and updates the status to PAID.
     * Idempotent: returns the current view if the order is already confirmed.
     */
    @Transactional
    public PaymentService.PaymentView confirmPayment(Long orderId) {
        PurchaseOrder order = orders.findByIdForUpdate(orderId)
                .orElseThrow(() -> notFound("Pedido não encontrado."));
        if (order.getPaymentProvider() != PaymentProvider.WHATSAPP) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Este pedido não é um pedido WhatsApp.");
        }
        order.confirmWhatsappPayment(); // idempotent inside the model
        return PaymentService.PaymentView.from(order);
    }

    /**
     * Cancels a WHATSAPP order and releases its reserved inventory (admin action).
     * Idempotent: returns the current view when the order is already in a terminal state.
     */
    @Transactional
    public PaymentService.PaymentView cancelOrder(Long orderId) {
        PurchaseOrder order = orders.findByIdForUpdate(orderId)
                .orElseThrow(() -> notFound("Pedido não encontrado."));
        if (order.getPaymentProvider() != PaymentProvider.WHATSAPP) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Este pedido não é um pedido WhatsApp.");
        }
        cancelAndRestoreReservedInventory(order);
        return PaymentService.PaymentView.from(order);
    }

    /**
     * Periodically expires WHATSAPP orders that have passed their configured TTL without
     * receiving manual payment confirmation. Releases reserved inventory exactly once per order.
     */
    @Scheduled(fixedDelayString = "${app.store.whatsapp-expiry-check-interval-ms:300000}",
               initialDelayString = "${app.store.whatsapp-expiry-check-interval-ms:300000}")
    public void expireStaleWhatsappOrders() {
        Instant now = Instant.now();
        List<Long> expired = orders.findExpiredWhatsappOrderIds(
                PaymentProvider.WHATSAPP, PaymentState.PENDING, now, PageRequest.of(0, 50));
        for (Long orderId : expired) {
            try {
                transactions.executeWithoutResult(ignored -> {
                    PurchaseOrder order = orders.findByIdForUpdate(orderId).orElse(null);
                    if (order == null
                            || order.getPaymentProvider() != PaymentProvider.WHATSAPP
                            || !order.canCancelPayment()
                            || order.getWhatsappExpiresAt() == null
                            || order.getWhatsappExpiresAt().isAfter(Instant.now())) return;
                    if (cancelAndRestoreReservedInventory(order)) {
                        LOG.info("WhatsApp order expired and cancelled: orderId={}", orderId);
                    }
                });
            } catch (RuntimeException ex) {
                LOG.warn("WhatsApp order expiry deferred: orderId={} reason={}", orderId, ex.getMessage());
            }
        }
    }

    /**
     * Restores stock and cancels a pending WhatsApp order in the caller's transaction.
     * The order row is already locked by every caller. The inventory status is the
     * idempotency guard: after the first successful transaction the order is terminal
     * and no longer RESERVED, so retries cannot add the quantities again.
     */
    private boolean cancelAndRestoreReservedInventory(PurchaseOrder order) {
        if (!order.canCancelPayment()) return false;
        if (order.getInventoryStatus() != InventoryStatus.RESERVED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "O estoque reservado deste pedido requer revisão manual.");
        }

        for (PurchaseOrderItem item : order.getItems().stream()
                .sorted(Comparator.comparing(PurchaseOrderItem::getProductId))
                .toList()) {
            Product product = products.findByIdForUpdate(item.getProductId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                            "Um produto do pedido não existe mais. É necessária revisão manual."));
            product.setStockQuantity(Math.addExact(product.getStockQuantity(), item.getQuantity()));
        }
        order.cancelWhatsappOrder();
        return true;
    }

    // ── Internal transaction ─────────────────────────────────────────────────────

    private WhatsappCheckoutResult doStartCheckout(CustomerAccount customer,
                                                   CheckoutCustomer details,
                                                   List<RequestedItem> requestedItems,
                                                   Map<Long, Integer> quantities,
                                                   String idempotencyKey,
                                                   String requestHash,
                                                   Runnable persistence) {
        PaymentCheckoutAttempt attempt = checkoutAttempts.findByIdForUpdate(idempotencyKey)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "A tentativa de pagamento não pôde ser recuperada."));

        // ── Conflict / ownership check ────────────────────────────────────────
        if (!Objects.equals(customer.getId(), attempt.getCustomerId())) {
            throw new CheckoutConflictException("IDEMPOTENCY_PAYLOAD_MISMATCH",
                    "A chave de idempotência já foi usada com outro checkout.");
        }
        if (!constantTimeEquals(requestHash, attempt.getRequestHash())) {
            throw new CheckoutConflictException("IDEMPOTENCY_PAYLOAD_MISMATCH",
                    "A chave de idempotência já foi usada com outro checkout.");
        }
        if ("FAILED".equals(attempt.getState())) {
            throw new CheckoutConflictException("CHECKOUT_ATTEMPT_TERMINAL",
                    "Esta tentativa de checkout foi encerrada. Inicie uma nova.");
        }

        // ── Replay ────────────────────────────────────────────────────────────
        if ("READY".equals(attempt.getState()) && attempt.getOrderId() != null) {
            PurchaseOrder existing = orders.findByIdForUpdate(attempt.getOrderId()).orElse(null);
            if (existing != null
                    && existing.getPaymentProvider() == PaymentProvider.WHATSAPP
                    && existing.getWhatsappUrl() != null) {
                return new WhatsappCheckoutResult(existing.getId(), existing.getWhatsappUrl());
            }
        }

        // ── In-progress guard ─────────────────────────────────────────────────
        if (attempt.creationInProgress(Instant.now())) {
            throw new CheckoutConflictException("CHECKOUT_ATTEMPT_IN_PROGRESS",
                    "Este checkout já está sendo criado. Tente novamente em alguns instantes.");
        }

        // ── Profile/address persistence (runs inside this transaction) ────────
        persistence.run();

        // ── Load products with pessimistic write lock ─────────────────────────
        Map<Long, Product> productMap = new HashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            Product product = products.findByIdForUpdate(entry.getKey())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "Produto #" + entry.getKey() + " não encontrado."));
            int qty = entry.getValue();
            if (qty > 99) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A quantidade máxima por produto é 99.");
            }
            if (product.getStockQuantity() < qty) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Estoque insuficiente para \"" + product.getName() + "\".");
            }
            // Reserve stock immediately (same pattern as PaymentService)
            product.setStockQuantity(product.getStockQuantity() - qty);
            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(qty)));
            productMap.put(product.getId(), product);
        }

        // ── Create the order ─────────────────────────────────────────────────
        PurchaseOrder order = new PurchaseOrder(customer,
                details.fullName(), details.email(), details.cpf(),
                "WHATSAPP",
                details.postalCode(), details.state(), details.city(),
                details.neighborhood(), details.street(), details.addressNumber(),
                details.complement(), total);
        // The idempotency key doubles as the external reference (consistent with PaymentService)
        order.setExternalReference(idempotencyKey);
        order.setCheckoutRequestHash(requestHash);

        for (RequestedItem item : requestedItems) {
            Product product = productMap.get(item.productId());
            if (product != null) {
                String productName = product.getName().substring(0, Math.min(product.getName().length(), 180));
                order.addItem(new PurchaseOrderItem(product.getId(), productName, item.quantity(), product.getPrice(), item.shoeSize(), item.colorVariant()));
            }
        }

        // Compute expiry and build the wa.me URL with a placeholder id (0) — we update after flush
        Instant expiresAt = Instant.now().plus(storeProperties.getWhatsappExpiryMinutes(), ChronoUnit.MINUTES);
        String placeholderUrl = buildAndValidateWhatsappUrl(storeProperties.getWhatsappNumber(), 0L, total);

        // Transition provider, reserve inventory, set URL/expiry
        order.setupWhatsappOrder(placeholderUrl, expiresAt);

        try {
            orders.saveAndFlush(order);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Pedido duplicado detectado.");
        }

        // Now that we have the real id, update the URL in-place on the managed entity
        String finalUrl = buildAndValidateWhatsappUrl(storeProperties.getWhatsappNumber(), order.getId(), total);
        order.setupWhatsappOrder(finalUrl, expiresAt); // updates whatsappUrl and expiresAt; inventoryStatus stays RESERVED

        // Link attempt to order
        attempt.attachOrder(order.getId());
        attempt.markReady();

        LOG.info("WhatsApp order created: orderId={}", order.getId());
        return new WhatsappCheckoutResult(order.getId(), finalUrl);
    }

    // ── URL builder / validator ───────────────────────────────────────────────

    /**
     * Builds and validates the wa.me URL. The message is strictly:
     * {@code "Olá! Quero combinar o pagamento do pedido #<id>, no valor de R$ <total>."}
     * No PII (name, CPF, e-mail, address, products) is included.
     */
    static String buildAndValidateWhatsappUrl(String number, Long orderId, BigDecimal total) {
        String totalStr = total.setScale(2, RoundingMode.HALF_UP)
                .toPlainString()
                .replace('.', ',');
        String message = "Olá! Quero combinar o pagamento do pedido #" + orderId
                + ", no valor de R$ " + totalStr + ".";
        String encoded = URLEncoder.encode(message, StandardCharsets.UTF_8)
                // WhatsApp prefers %20 for spaces over '+' used by some encoders
                .replace("+", "%20");
        String url = WA_ME_SCHEME + "://" + WA_ME_HOST + "/" + number + "?text=" + encoded;

        // Requirement 6: validate the generated URL is HTTPS and belongs exactly to wa.me
        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException ex) {
            LOG.error("Generated WhatsApp URL is syntactically invalid; check APP_STORE_WHATSAPP_NUMBER");
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Erro interno: URL do WhatsApp inválida. Verifique a configuração.");
        }
        if (!WA_ME_SCHEME.equals(uri.getScheme())) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Erro interno: URL do WhatsApp não usa HTTPS.");
        }
        if (!WA_ME_HOST.equals(uri.getHost())) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Erro interno: URL do WhatsApp não pertence a wa.me.");
        }
        return url;
    }

    // ── Validation helpers ────────────────────────────────────────────────────

    private void validateWhatsappNumber() {
        if (!storeProperties.isWhatsappNumberValid()) {
            LOG.error("APP_STORE_WHATSAPP_NUMBER is absent or invalid; checkout rejected");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "O pagamento via WhatsApp não está configurado. Contate o administrador da loja.");
        }
    }

    private void ensureCheckoutAttempt(String key, Long customerId, String requestHash) {
        try {
            transactions.executeWithoutResult(ignored -> {
                if (!checkoutAttempts.existsById(key)) {
                    checkoutAttempts.saveAndFlush(new PaymentCheckoutAttempt(key, customerId, requestHash));
                }
            });
        } catch (DataIntegrityViolationException concurrentInsert) {
            Boolean exists = transactions.execute(ignored -> checkoutAttempts.existsById(key));
            if (!Boolean.TRUE.equals(exists)) throw concurrentInsert;
        }
    }

    // ── Shared utilities ──────────────────────────────────────────────────────

    static Map<Long, Integer> aggregate(List<RequestedItem> items) {
        if (items == null || items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Adicione ao menos um item ao carrinho.");
        }
        Map<Long, Integer> quantities = new TreeMap<>();
        for (RequestedItem item : items) {
            if (item.productId() == null || item.quantity() == null || item.quantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item inválido no carrinho.");
            }
            quantities.merge(item.productId(), item.quantity(), Integer::sum);
        }
        return quantities;
    }

    /** Produces a deterministic SHA-256 hash of the checkout inputs. */
    static String checkoutRequestHash(CheckoutCustomer customer,
                                       Map<Long, Integer> quantities,
                                       CheckoutPersistenceIntent intent) {
        try {
            // Use a stable string representation — same approach as PaymentService
            String content = "provider=WHATSAPP"
                    + "|fullName=" + nullSafe(customer.fullName())
                    + "|email=" + nullSafe(customer.email())
                    + "|cpf=" + nullSafe(customer.cpf())
                    + "|postalCode=" + nullSafe(customer.postalCode())
                    + "|state=" + nullSafe(customer.state())
                    + "|city=" + nullSafe(customer.city())
                    + "|neighborhood=" + nullSafe(customer.neighborhood())
                    + "|street=" + nullSafe(customer.street())
                    + "|addressNumber=" + nullSafe(customer.addressNumber())
                    + "|complement=" + nullSafe(customer.complement())
                    + "|quantities=" + new TreeMap<>(quantities)
                    + "|profileTarget=" + intent.profileTarget()
                    + "|addressTarget=" + intent.addressTarget()
                    + "|defaultAddressTarget=" + intent.defaultAddressTarget()
                    + "|addressLabel=" + nullSafe(intent.addressLabel());
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(content.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(64);
            for (byte b : digest) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }

    /** Constant-time string comparison to prevent timing attacks on idempotency keys. */
    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) return false;
        if (a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) diff |= a.charAt(i) ^ b.charAt(i);
        return diff == 0;
    }

    private static ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    // ── Public result type ────────────────────────────────────────────────────

    /** Returned to the controller and then to the browser after a successful checkout. */
    public record WhatsappCheckoutResult(Long orderId, String whatsappUrl) { }
}
