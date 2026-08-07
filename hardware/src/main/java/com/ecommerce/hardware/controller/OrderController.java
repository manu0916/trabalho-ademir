package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.CustomerAccount;
import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.model.PurchaseOrderItem;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import jakarta.servlet.http.HttpSession;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/customer/orders")
public class OrderController {

    private static final Set<String> PAYMENT_METHODS = Set.of("PIX", "CARTAO_CREDITO", "BOLETO");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final CustomerAccountRepository customerAccountRepository;
    private final ProductRepository productRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;

    public OrderController(CustomerAccountRepository customerAccountRepository,
                           ProductRepository productRepository,
                           PurchaseOrderRepository purchaseOrderRepository) {
        this.customerAccountRepository = customerAccountRepository;
        this.productRepository = productRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
    }

    @PostMapping
    @Transactional
    public OrderResponse create(@RequestBody CreateOrderRequest request, HttpSession session) {
        CustomerAccount customer = currentCustomer(session);
        validateCustomerData(request);

        if (request.items() == null || request.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Adicione ao menos um item ao carrinho.");
        }

        BigDecimal total = BigDecimal.ZERO;
        PurchaseOrder order = new PurchaseOrder(customer, request.fullName().trim(), request.email().trim().toLowerCase(),
                onlyDigits(request.cpf()), request.paymentMethod(), BigDecimal.ZERO);

        for (OrderItemRequest item : request.items()) {
            validateItem(item);
            var product = productRepository.findById(item.productId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Produto não encontrado."));
            BigDecimal unitPrice = product.getPrice();
            total = total.add(unitPrice.multiply(BigDecimal.valueOf(item.quantity())));
            order.addItem(new PurchaseOrderItem(product.getId(), product.getName(), item.quantity(), unitPrice));
        }

        PurchaseOrder saved = purchaseOrderRepository.save(new PurchaseOrder(customer, request.fullName().trim(),
                request.email().trim().toLowerCase(), onlyDigits(request.cpf()), request.paymentMethod(), total));
        order.getItems().forEach(saved::addItem);
        return toResponse(purchaseOrderRepository.save(saved));
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<OrderResponse> history(HttpSession session) {
        Long customerId = customerId(session);
        return purchaseOrderRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(this::toResponse)
                .toList();
    }

    private CustomerAccount currentCustomer(HttpSession session) {
        Long customerId = customerId(session);
        return customerAccountRepository.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar."));
    }

    private Long customerId(HttpSession session) {
        Object value = session.getAttribute(CustomerAuthController.CUSTOMER_ID_SESSION_KEY);
        if (!(value instanceof Long customerId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar.");
        }
        return customerId;
    }

    private void validateCustomerData(CreateOrderRequest request) {
        if (request.fullName() == null || request.fullName().trim().length() < 5 || request.fullName().trim().length() > 160) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome completo.");
        }
        if (request.email() == null || !EMAIL_PATTERN.matcher(request.email().trim()).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um e-mail válido.");
        }
        if (!isValidCpf(request.cpf())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CPF inválido.");
        }
        if (request.paymentMethod() == null || !PAYMENT_METHODS.contains(request.paymentMethod())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione uma forma de pagamento válida.");
        }
    }

    private void validateItem(OrderItemRequest item) {
        if (item == null || item.productId() == null || item.quantity() == null
                || item.quantity() < 1 || item.quantity() > 99) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Um item do pedido é inválido.");
        }
    }

    private boolean isValidCpf(String value) {
        String cpf = onlyDigits(value);
        if (cpf.length() != 11 || cpf.chars().distinct().count() == 1) {
            return false;
        }
        return digit(cpf, 9) == cpf.charAt(9) - '0' && digit(cpf, 10) == cpf.charAt(10) - '0';
    }

    private int digit(String cpf, int length) {
        int total = 0;
        for (int index = 0; index < length; index++) {
            total += (cpf.charAt(index) - '0') * (length + 1 - index);
        }
        int remainder = (total * 10) % 11;
        return remainder == 10 ? 0 : remainder;
    }

    private String onlyDigits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private OrderResponse toResponse(PurchaseOrder order) {
        return new OrderResponse(order.getId(), order.getFullName(), order.getEmail(), order.getCpf(),
                order.getPaymentMethod(), order.getTotal(), order.getStatus(), order.getCreatedAt(),
                order.getItems().stream().map(item -> new OrderItemResponse(item.getProductId(), item.getProductName(),
                        item.getQuantity(), item.getUnitPrice())).toList());
    }

    public record CreateOrderRequest(String fullName, String email, String cpf, String paymentMethod,
                                     List<OrderItemRequest> items) {
    }

    public record OrderItemRequest(Long productId, Integer quantity) {
    }

    public record OrderResponse(Long id, String fullName, String email, String cpf, String paymentMethod,
                                BigDecimal total, String status, java.time.Instant createdAt,
                                List<OrderItemResponse> items) {
    }

    public record OrderItemResponse(Long productId, String productName, Integer quantity, BigDecimal unitPrice) {
    }
}
