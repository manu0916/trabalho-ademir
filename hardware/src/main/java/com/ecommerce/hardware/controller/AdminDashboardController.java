package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/dashboard")
public class AdminDashboardController {
    private final ProductRepository products;
    private final CustomerAccountRepository customers;
    private final PurchaseOrderRepository orders;

    public AdminDashboardController(ProductRepository products, CustomerAccountRepository customers,
                                    PurchaseOrderRepository orders) {
        this.products = products;
        this.customers = customers;
        this.orders = orders;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public DashboardResponse dashboard() {
        List<PurchaseOrder> paidOrders = orders.findByStatus("PAID");
        long productsSold = paidOrders.stream().flatMap(order -> order.getItems().stream())
                .mapToLong(item -> item.getQuantity()).sum();
        BigDecimal revenue = paidOrders.stream().map(PurchaseOrder::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<ProductResponse> inventory = products.findAllByOrderByIdDesc().stream().map(ProductResponse::from).toList();
        List<AdminOrderResponse> orderHistory = orders.findAllByOrderByCreatedAtDesc().stream().map(this::toOrderResponse).toList();
        return new DashboardResponse(productsSold, customers.count(), revenue, inventory.size(), inventory, orderHistory);
    }

    private AdminOrderResponse toOrderResponse(PurchaseOrder order) {
        return new AdminOrderResponse(order.getId(), order.getFullName(), order.getEmail(), order.getCpf(),
                order.getPaymentMethod(), order.getPostalCode(), order.getState(), order.getCity(), order.getNeighborhood(),
                order.getStreet(), order.getAddressNumber(), order.getTotal(), order.getStatus(), order.getCreatedAt(),
                order.getItems().stream().map(item -> new AdminOrderItemResponse(item.getProductName(), item.getQuantity(), item.getUnitPrice())).toList());
    }

    public record DashboardResponse(long productsSold, long accountsCreated, BigDecimal revenue,
                                    long registeredProducts, List<ProductResponse> inventory, List<AdminOrderResponse> orders) { }
    public record AdminOrderResponse(Long id, String fullName, String email, String cpf, String paymentMethod,
                                     String postalCode, String state, String city, String neighborhood, String street,
                                     String addressNumber, BigDecimal total, String status, java.time.Instant createdAt,
                                     List<AdminOrderItemResponse> items) { }
    public record AdminOrderItemResponse(String productName, Integer quantity, BigDecimal unitPrice) { }
}
