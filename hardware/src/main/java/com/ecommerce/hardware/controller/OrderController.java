package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import jakarta.servlet.http.HttpSession;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Read-only order history. New orders can only be created through the payment checkout endpoint. */
@RestController
@RequestMapping("/api/customer/orders")
public class OrderController {
    private final PurchaseOrderRepository orders;

    public OrderController(PurchaseOrderRepository orders) {
        this.orders = orders;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<OrderResponse> history(HttpSession session) {
        return orders.findByCustomerIdOrderByCreatedAtDesc(customerId(session)).stream()
                .map(this::toResponse)
                .toList();
    }

    private Long customerId(HttpSession session) {
        Object value = session.getAttribute(CustomerAuthController.CUSTOMER_ID_SESSION_KEY);
        if (!(value instanceof Long customerId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login para continuar.");
        }
        return customerId;
    }

    private OrderResponse toResponse(PurchaseOrder order) {
        return new OrderResponse(order.getId(), order.getFullName(), order.getEmail(), order.getCpf(),
                order.getPaymentMethod(), order.getPostalCode(), order.getState(), order.getCity(), order.getNeighborhood(),
                order.getStreet(), order.getAddressNumber(), order.getTotal(), order.getStatus().name(), order.getCreatedAt(),
                order.getItems().stream().map(item -> new OrderItemResponse(item.getProductId(), item.getProductName(),
                        item.getQuantity(), item.getUnitPrice())).toList());
    }

    public record OrderResponse(Long id, String fullName, String email, String cpf, String paymentMethod,
                                String postalCode, String state, String city, String neighborhood, String street,
                                String addressNumber, BigDecimal total, String status, java.time.Instant createdAt,
                                List<OrderItemResponse> items) { }

    public record OrderItemResponse(Long productId, String productName, Integer quantity, BigDecimal unitPrice) { }
}
