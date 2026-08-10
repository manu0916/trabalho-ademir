package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.CustomerAccount;
import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.model.PurchaseOrderItem;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import com.ecommerce.hardware.service.MercadoPagoClient;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Creates hosted Checkout Pro sessions and validates every gateway notification server-to-server. */
@RestController
public class PaymentController {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Set<String> PAYMENT_METHODS = Set.of("PIX", "CARTAO_CREDITO", "BOLETO");
    private final CustomerAccountRepository customerAccounts;
    private final ProductRepository products;
    private final PurchaseOrderRepository orders;
    private final MercadoPagoClient mercadoPago;

    public PaymentController(CustomerAccountRepository customerAccounts, ProductRepository products,
                             PurchaseOrderRepository orders, MercadoPagoClient mercadoPago) {
        this.customerAccounts = customerAccounts;
        this.products = products;
        this.orders = orders;
        this.mercadoPago = mercadoPago;
    }

    @PostMapping("/api/customer/payments/checkout")
    public CheckoutResponse checkout(@Valid @RequestBody CheckoutRequest request, HttpSession session) {
        CustomerAccount customer = currentCustomer(session);
        validateCustomer(request);

        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (CheckoutItemRequest item : request.items()) {
            quantities.merge(item.productId(), item.quantity(), Integer::sum);
        }

        BigDecimal total = BigDecimal.ZERO;
        List<MercadoPagoClient.CheckoutItem> paymentItems = new ArrayList<>();
        PurchaseOrder order = new PurchaseOrder(customer, request.fullName().trim(), request.email().trim().toLowerCase(),
                digits(request.cpf()), request.paymentMethod(), digits(request.postalCode()), request.state().trim().toUpperCase(),
                request.city().trim(), request.neighborhood().trim(), request.street().trim(), request.addressNumber().trim(), BigDecimal.ZERO);
        order.setExternalReference(UUID.randomUUID().toString());

        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            int quantity = entry.getValue();
            if (quantity > 99) throw badRequest("A quantidade máxima por produto é 99.");
            Product product = products.findById(entry.getKey()).orElseThrow(() -> badRequest("Produto não encontrado."));
            if (product.getStockQuantity() < quantity) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Estoque insuficiente para " + product.getName() + ".");
            }
            BigDecimal lineTotal = product.getPrice().multiply(BigDecimal.valueOf(quantity));
            total = total.add(lineTotal);
            order.addItem(new PurchaseOrderItem(product.getId(), product.getName(), quantity, product.getPrice()));
            paymentItems.add(new MercadoPagoClient.CheckoutItem(product.getId(), product.getName(), quantity, product.getPrice()));
        }

        order.setTotal(total);
        PurchaseOrder persisted = orders.saveAndFlush(order);
        MercadoPagoClient.Preference preference = mercadoPago.createPreference(persisted.getExternalReference(),
                persisted.getFullName(), persisted.getEmail(), persisted.getCpf(), paymentItems);
        persisted.setPaymentPreferenceId(preference.id());
        orders.save(persisted);
        return new CheckoutResponse(persisted.getId(), preference.checkoutUrl());
    }

    @PostMapping("/api/payments/mercado-pago/webhook")
    @Transactional
    public Map<String, Boolean> webhook(@RequestParam Map<String, String> params) {
        String paymentId = params.getOrDefault("data.id", params.get("id"));
        if (paymentId == null || paymentId.isBlank()) return Map.of("received", true);

        MercadoPagoClient.GatewayPayment payment = mercadoPago.getPayment(paymentId);
        if (!"approved".equals(payment.status()) || payment.externalReference() == null) {
            return Map.of("received", true);
        }
        PurchaseOrder order = orders.findByExternalReference(payment.externalReference())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido não encontrado."));
        if ("PAID".equals(order.getStatus())) return Map.of("received", true);

        for (PurchaseOrderItem item : order.getItems()) {
            Product product = products.findByIdForUpdate(item.getProductId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Produto removido após a compra."));
            if (product.getStockQuantity() < item.getQuantity()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Estoque insuficiente para confirmar este pagamento. Contate a loja.");
            }
            product.setStockQuantity(product.getStockQuantity() - item.getQuantity());
        }
        order.markPaid(payment.id());
        return Map.of("received", true);
    }

    private CustomerAccount currentCustomer(HttpSession session) {
        Object id = session.getAttribute(CustomerAuthController.CUSTOMER_ID_SESSION_KEY);
        if (!(id instanceof Long customerId)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar.");
        return customerAccounts.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar."));
    }

    private void validateCustomer(CheckoutRequest request) {
        if (request.items() == null || request.items().isEmpty()) throw badRequest("Adicione ao menos um item ao carrinho.");
        if (request.fullName().trim().length() < 5 || request.fullName().trim().length() > 160) throw badRequest("Informe o nome completo.");
        if (!EMAIL_PATTERN.matcher(request.email().trim()).matches()) throw badRequest("Informe um e-mail válido.");
        if (!isValidCpf(request.cpf())) throw badRequest("CPF inválido.");
        if (!PAYMENT_METHODS.contains(request.paymentMethod())) throw badRequest("Selecione uma forma de pagamento válida.");
        if (digits(request.postalCode()).length() != 8) throw badRequest("Informe um CEP válido.");
        if (request.state() == null || !request.state().trim().matches("[A-Za-z]{2}")) throw badRequest("Informe o estado.");
        if (isBlankOrTooLong(request.city(), 120) || isBlankOrTooLong(request.neighborhood(), 160)
                || isBlankOrTooLong(request.street(), 180) || isBlankOrTooLong(request.addressNumber(), 20)) {
            throw badRequest("Preencha todos os dados do endereço.");
        }
    }

    private static ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
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

    public record CheckoutRequest(@NotBlank String fullName, @NotBlank String email, @NotBlank String cpf,
                                  @NotBlank String paymentMethod, @NotBlank String postalCode, @NotBlank String state,
                                  @NotBlank String city, @NotBlank String neighborhood, @NotBlank String street,
                                  @NotBlank String addressNumber, @NotNull List<@Valid CheckoutItemRequest> items) { }
    public record CheckoutItemRequest(@NotNull Long productId, @NotNull @Positive Integer quantity) { }
    public record CheckoutResponse(Long orderId, String checkoutUrl) { }
}
