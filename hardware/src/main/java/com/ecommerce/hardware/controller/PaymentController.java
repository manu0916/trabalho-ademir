package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.CustomerAccount;
import com.ecommerce.hardware.config.StripeProperties;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.service.PaymentService;
import com.ecommerce.hardware.service.PaymentService.CheckoutCustomer;
import com.ecommerce.hardware.service.PaymentService.RequestedItem;
import com.ecommerce.hardware.service.PaymentService.CheckoutConflictException;
import com.ecommerce.hardware.service.StripePaymentGateway;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.LinkedHashSet;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.server.ResponseStatusException;

/** Stripe-hosted checkout entry points. Only signed webhooks can confirm financial state. */
@RestController
public class PaymentController {
    private static final int MAX_WEBHOOK_BYTES = 1_048_576;
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Set<String> PAYMENT_METHODS = Set.of("PIX", "CARTAO_CREDITO", "BOLETO");
    private final CustomerAccountRepository customerAccounts;
    private final PaymentService payments;
    private final StripePaymentGateway stripe;
    private final StripeProperties stripeProperties;

    public PaymentController(CustomerAccountRepository customerAccounts, PaymentService payments,
                             StripePaymentGateway stripe, StripeProperties stripeProperties) {
        this.customerAccounts = customerAccounts;
        this.payments = payments;
        this.stripe = stripe;
        this.stripeProperties = stripeProperties;
    }

    @PostMapping("/api/customer/payments/checkout")
    public PaymentService.CheckoutResult checkout(@Valid @RequestBody CheckoutRequest request,
                                                   @RequestHeader("Idempotency-Key") String idempotencyKey,
                                                   HttpSession session) {
        CustomerAccount customer = currentCustomer(session);
        validateCustomer(request);
        String checkoutAttempt = normalizeIdempotencyKey(idempotencyKey);
        CheckoutCustomer details = new CheckoutCustomer(request.fullName().trim(),
                request.email().trim().toLowerCase(), digits(request.cpf()), request.paymentMethod(),
                digits(request.postalCode()), request.state().trim().toUpperCase(), request.city().trim(),
                request.neighborhood().trim(), request.street().trim(), request.addressNumber().trim());
        List<RequestedItem> items = request.items().stream()
                .map(item -> new RequestedItem(item.productId(), item.quantity())).toList();
        return payments.startCheckout(customer, details, items, checkoutAttempt);
    }

    @GetMapping("/api/customer/payments/status")
    public PaymentService.PaymentView status(@RequestParam String sessionId, HttpSession session) {
        return payments.statusBySession(sessionId, customerId(session));
    }

    @GetMapping("/api/payments/methods")
    public PaymentMethodsResponse paymentMethods() {
        return new PaymentMethodsResponse(List.copyOf(enabledPaymentMethods()));
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
        return new PaymentErrorResponse(exception.getCode(), exception.getReason());
    }

    private CustomerAccount currentCustomer(HttpSession session) {
        Long id = customerId(session);
        return customerAccounts.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar."));
    }

    private Long customerId(HttpSession session) {
        Object id = session.getAttribute(CustomerAuthController.CUSTOMER_ID_SESSION_KEY);
        if (!(id instanceof Long customerId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar.");
        }
        return customerId;
    }

    private void validateCustomer(CheckoutRequest request) {
        if (request.items() == null || request.items().isEmpty()) throw badRequest("Adicione ao menos um item ao carrinho.");
        if (request.fullName().trim().length() < 5 || request.fullName().trim().length() > 160) throw badRequest("Informe o nome completo.");
        if (request.email().trim().length() > 254
                || !EMAIL_PATTERN.matcher(request.email().trim()).matches()) throw badRequest("Informe um e-mail válido.");
        if (!isValidCpf(request.cpf())) throw badRequest("CPF inválido.");
        if (!enabledPaymentMethods().contains(request.paymentMethod())) {
            throw badRequest("A forma de pagamento selecionada não está habilitada.");
        }
        if (digits(request.postalCode()).length() != 8) throw badRequest("Informe um CEP válido.");
        if (request.state() == null || !request.state().trim().matches("[A-Za-z]{2}")) throw badRequest("Informe o estado.");
        if (isBlankOrTooLong(request.city(), 120) || isBlankOrTooLong(request.neighborhood(), 160)
                || isBlankOrTooLong(request.street(), 180) || isBlankOrTooLong(request.addressNumber(), 20)) {
            throw badRequest("Preencha todos os dados do endereço.");
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

    private static String digits(String value) { return value == null ? "" : value.replaceAll("\\D", ""); }

    private static boolean isValidCpf(String value) {
        String cpf = digits(value);
        if (cpf.length() != 11 || cpf.chars().distinct().count() == 1) return false;
        return cpfDigit(cpf, 9) == cpf.charAt(9) - '0' && cpfDigit(cpf, 10) == cpf.charAt(10) - '0';
    }

    private static boolean isBlankOrTooLong(String value, int maxLength) {
        return value == null || value.trim().isEmpty() || value.trim().length() > maxLength;
    }

    private static int cpfDigit(String cpf, int length) {
        int total = 0;
        for (int index = 0; index < length; index++) total += (cpf.charAt(index) - '0') * (length + 1 - index);
        int value = (total * 10) % 11;
        return value == 10 ? 0 : value;
    }

    private Set<String> enabledPaymentMethods() {
        Set<String> enabled = new LinkedHashSet<>();
        String configured = stripeProperties.getEnabledPaymentMethods();
        if (configured != null) {
            for (String value : configured.split(",")) {
                String normalized = value.trim().toUpperCase();
                if (PAYMENT_METHODS.contains(normalized)) enabled.add(normalized);
            }
        }
        if (enabled.isEmpty()) enabled.add("CARTAO_CREDITO");
        return enabled;
    }

    public record CheckoutRequest(@NotBlank @Size(max = 160) String fullName,
                                  @NotBlank @Size(max = 254) String email,
                                  @NotBlank @Size(max = 20) String cpf,
                                  @NotBlank @Size(max = 30) String paymentMethod,
                                  @NotBlank @Size(max = 10) String postalCode,
                                  @NotBlank @Size(max = 2) String state,
                                  @NotBlank @Size(max = 120) String city,
                                  @NotBlank @Size(max = 160) String neighborhood,
                                  @NotBlank @Size(max = 180) String street,
                                  @NotBlank @Size(max = 20) String addressNumber,
                                  @NotNull @Size(min = 1, max = 100)
                                  List<@NotNull @Valid CheckoutItemRequest> items) { }
    public record CheckoutItemRequest(@NotNull Long productId, @NotNull @Positive Integer quantity) { }
    public record PaymentMethodsResponse(List<String> methods) { }
    public record PaymentErrorResponse(String code, String message) { }
}
