package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.config.StripeProperties;
import com.ecommerce.hardware.model.CustomerAccount;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.service.PaymentService;
import com.ecommerce.hardware.service.PaymentService.CheckoutConflictException;
import com.ecommerce.hardware.service.CustomerAccountService;
import com.ecommerce.hardware.service.CustomerAccountService.AddressInput;
import com.ecommerce.hardware.service.CustomerAccountService.CheckoutInput;
import com.ecommerce.hardware.service.CustomerAccountService.CheckoutResolution;
import com.ecommerce.hardware.service.WhatsappCheckoutService;
import com.ecommerce.hardware.service.WhatsappCheckoutService.WhatsappCheckoutResult;
import com.ecommerce.hardware.service.PaymentService.CheckoutCustomer;
import com.ecommerce.hardware.service.PaymentService.CheckoutPersistenceIntent;
import com.ecommerce.hardware.service.PaymentService.RequestedItem;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Customer-facing payment endpoints.
 *
 * <p>The primary checkout flow uses the WHATSAPP provider: the order is created and
 * inventory is reserved, then the client is redirected to a wa.me link to arrange payment
 * with the store. The Stripe-hosted checkout flow is preserved for backward compatibility
 * with legacy integrations and tests.
 */
@RestController
public class PaymentController {
    private static final int MAX_WEBHOOK_BYTES = 1_048_576;
    private static final Set<String> STRIPE_METHODS = Set.of("CARTAO_CREDITO", "BOLETO", "PIX");

    private final CustomerAccountRepository customerAccounts;
    private final CustomerAccountService accountService;
    private final PaymentService payments;
    private final WhatsappCheckoutService whatsappCheckout;
    private final StripeProperties stripeProperties;
    private final com.ecommerce.hardware.service.StripePaymentGateway stripe;

    public PaymentController(CustomerAccountRepository customerAccounts,
                             CustomerAccountService accountService,
                             PaymentService payments,
                             WhatsappCheckoutService whatsappCheckout,
                             StripeProperties stripeProperties,
                             com.ecommerce.hardware.service.StripePaymentGateway stripe) {
        this.customerAccounts = customerAccounts;
        this.accountService = accountService;
        this.payments = payments;
        this.whatsappCheckout = whatsappCheckout;
        this.stripeProperties = stripeProperties;
        this.stripe = stripe;
    }

    /**
     * Creates a new order. Defaults to the WHATSAPP provider; routes to Stripe if a legacy
     * Stripe payment method (CARTAO_CREDITO, BOLETO, PIX) is explicitly provided.
     * Idempotent: sending the same {@code Idempotency-Key} with the same payload returns the
     * existing order without creating duplicates or double-reserving stock.
     */
    @PostMapping("/api/customer/payments/checkout")
    public CheckoutResponse checkout(@Valid @RequestBody CheckoutRequest request,
                                     @RequestHeader("Idempotency-Key") String idempotencyKey,
                                     HttpSession session) {
        Long customerId = customerId(session);
        validateCheckoutBasics(request);
        String checkoutAttempt = normalizeIdempotencyKey(idempotencyKey);
        CheckoutInput checkoutInput = new CheckoutInput(
                request.personalDataMode(), request.fullName(), request.email(), request.cpf(),
                Boolean.TRUE.equals(request.saveProfile()), request.addressId(),
                new AddressInput(request.addressLabel(), request.postalCode(), request.state(), request.city(),
                        request.neighborhood(), request.street(), request.addressNumber(), request.complement(),
                        Boolean.TRUE.equals(request.makeDefaultAddress())),
                Boolean.TRUE.equals(request.saveAddress()));
        CheckoutResolution resolved = accountService.previewCheckout(customerId, checkoutInput);
        CustomerAccount customer = currentCustomer(session);

        String rawMethod = request.paymentMethod();
        String method = rawMethod == null ? "" : rawMethod.trim().toUpperCase();
        boolean isStripeMethod = STRIPE_METHODS.contains(method);

        CheckoutPersistenceIntent persistenceIntent = new CheckoutPersistenceIntent(
                resolved.profileTarget(), resolved.addressTarget(), resolved.defaultAddressTarget(),
                resolved.addressLabel());
        List<RequestedItem> items = request.items().stream()
                .map(item -> new RequestedItem(item.productId(), item.quantity())).toList();

        if (isStripeMethod) {
            CheckoutCustomer details = new CheckoutCustomer(resolved.fullName(), resolved.email(), resolved.cpf(),
                    method, resolved.postalCode(), resolved.state(), resolved.city(),
                    resolved.neighborhood(), resolved.street(), resolved.addressNumber(), resolved.complement());
            PaymentService.CheckoutResult result = payments.startCheckout(customer, details, items, checkoutAttempt,
                    persistenceIntent, () -> accountService.persistCheckout(customerId, checkoutInput));
            return new CheckoutResponse(result.orderId(), result.checkoutUrl(), null);
        } else {
            CheckoutCustomer details = new CheckoutCustomer(resolved.fullName(), resolved.email(), resolved.cpf(),
                    "WHATSAPP", resolved.postalCode(), resolved.state(), resolved.city(),
                    resolved.neighborhood(), resolved.street(), resolved.addressNumber(), resolved.complement());
            WhatsappCheckoutResult result = whatsappCheckout.startCheckout(customer, details, items, checkoutAttempt,
                    persistenceIntent, () -> accountService.persistCheckout(customerId, checkoutInput));
            return new CheckoutResponse(result.orderId(), result.whatsappUrl(), result.whatsappUrl());
        }
    }

    /**
     * Returns the order payment status by Stripe session id (kept for legacy Stripe orders).
     */
    @GetMapping("/api/customer/payments/status")
    public PaymentService.PaymentView status(@RequestParam String sessionId, HttpSession session) {
        return payments.statusBySession(sessionId, customerId(session));
    }

    /**
     * Lists enabled payment methods for Stripe compatibility.
     */
    @GetMapping("/api/payments/methods")
    public PaymentMethodsResponse paymentMethods() {
        String enabled = stripeProperties.getEnabledPaymentMethods();
        List<String> list = enabled == null || enabled.isBlank() ? List.of()
                : Arrays.stream(enabled.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .toList();
        return new PaymentMethodsResponse(list);
    }

    @GetMapping("/api/customer/payments/orders/{orderId}/status")
    public PaymentService.PaymentView orderStatus(@PathVariable Long orderId, HttpSession session) {
        return payments.statusByOrder(orderId, customerId(session));
    }

    @PostMapping("/api/customer/payments/orders/{orderId}/cancel")
    public PaymentService.PaymentView cancel(@PathVariable Long orderId, HttpSession session) {
        return payments.cancel(orderId, customerId(session));
    }

    @PostMapping("/api/admin/orders/{orderId}/refund")
    public PaymentService.PaymentView refund(@PathVariable Long orderId) {
        return payments.refund(orderId);
    }

    /** Stripe webhook — only signed events can confirm financial state. */
    @PostMapping("/api/payments/stripe/webhook")
    public Map<String, Boolean> webhook(@RequestBody byte[] rawPayload,
                                        @RequestHeader(name = "Stripe-Signature", required = false) String signature) {
        if (rawPayload.length == 0 || rawPayload.length > MAX_WEBHOOK_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payload do webhook inválido.");
        }
        var event = stripe.verifyWebhook(new String(rawPayload, StandardCharsets.UTF_8), signature);
        payments.processWebhook(event);
        return Map.of("received", true);
    }

    @ExceptionHandler(CheckoutConflictException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public PaymentErrorResponse checkoutConflict(CheckoutConflictException exception) {
        return new PaymentErrorResponse(exception.getCode(), exception.getMessage());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private CustomerAccount currentCustomer(HttpSession session) {
        Long id = customerId(session);
        return customerAccounts.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Faça login para continuar."));
    }

    private Long customerId(HttpSession session) {
        Object id = session.getAttribute(CustomerAuthController.CUSTOMER_ID_SESSION_KEY);
        if (!(id instanceof Long customerId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar.");
        }
        return customerId;
    }

    private void validateCheckoutBasics(CheckoutRequest request) {
        if (request.items() == null || request.items().isEmpty()) {
            throw badRequest("Adicione ao menos um item ao carrinho.");
        }
    }

    private static String normalizeIdempotencyKey(String value) {
        try {
            return UUID.fromString(value.trim()).toString();
        } catch (RuntimeException exception) {
            throw badRequest("Chave de idempotência inválida.");
        }
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    // ── Request / response records ────────────────────────────────────────────

    public record CheckoutRequest(@Size(max = 10) String personalDataMode,
                                  @Size(max = 160) String fullName,
                                  @Size(max = 254) String email,
                                  @Size(max = 20) String cpf,
                                  @Size(max = 30) String paymentMethod,
                                  Boolean saveProfile,
                                  Long addressId,
                                  @Size(max = 60) String addressLabel,
                                  @Size(max = 10) String postalCode,
                                  @Size(max = 2) String state,
                                  @Size(max = 120) String city,
                                  @Size(max = 160) String neighborhood,
                                  @Size(max = 180) String street,
                                  @Size(max = 20) String addressNumber,
                                  @Size(max = 120) String complement,
                                  Boolean saveAddress,
                                  Boolean makeDefaultAddress,
                                  @NotNull @Size(min = 1, max = 100)
                                  List<@NotNull @Valid CheckoutItemRequest> items) { }

    public record CheckoutItemRequest(@NotNull Long productId, @NotNull @Positive Integer quantity) { }
    public record CheckoutResponse(Long orderId, String checkoutUrl, String whatsappUrl) { }
    public record PaymentMethodsResponse(List<String> methods) { }
    public record PaymentErrorResponse(String code, String message) { }
}
