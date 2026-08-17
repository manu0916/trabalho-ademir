package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.model.InventoryStatus;
import com.ecommerce.hardware.model.PaymentProvider;
import com.ecommerce.hardware.model.PaymentState;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import com.ecommerce.hardware.repository.PaymentDisputeRepository;
import com.ecommerce.hardware.service.ProductService;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/dashboard")
public class AdminDashboardController {
    private final ProductService products;
    private final CustomerAccountRepository customers;
    private final PurchaseOrderRepository orders;
    private final PaymentDisputeRepository disputes;

    public AdminDashboardController(ProductService products, CustomerAccountRepository customers,
                                    PurchaseOrderRepository orders, PaymentDisputeRepository disputes) {
        this.products = products;
        this.customers = customers;
        this.orders = orders;
        this.disputes = disputes;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public DashboardResponse dashboard() {
        List<PurchaseOrder> orderHistoryEntities = orders.findAllByOrderByCreatedAtDesc();
        List<PurchaseOrder> capturedOrders = orderHistoryEntities.stream()
                .filter(PurchaseOrder::isPaymentVerified)
                .toList();
        long productsSold = capturedOrders.stream()
                .filter(order -> order.getInventoryStatus() == InventoryStatus.COMMITTED)
                .flatMap(order -> order.getItems().stream())
                .mapToLong(item -> item.getQuantity()).sum();
        BigDecimal revenue = capturedOrders.stream()
                .map(order -> order.getTotal().subtract(order.getRefundedAmount())
                        .subtract(disputes.sumAmountAtRisk(order.getId())).max(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<ProductResponse> inventory = products.listProducts();
        List<AdminOrderResponse> orderHistory = orderHistoryEntities.stream().map(this::toOrderResponse).toList();
        return new DashboardResponse(productsSold, customers.count(), revenue, inventory.size(), inventory, orderHistory);
    }

    private AdminOrderResponse toOrderResponse(PurchaseOrder order) {
        boolean isWhatsapp = order.getPaymentProvider() == PaymentProvider.WHATSAPP;
        boolean canConfirmWhatsapp = isWhatsapp
                && order.getPaymentState() == PaymentState.PENDING;
        boolean canCancelWhatsapp = isWhatsapp && order.canCancelPayment();
        return new AdminOrderResponse(order.getId(), order.getFullName(), order.getEmail(), maskCpf(order.getCpf()),
                order.getPaymentMethod(), order.getPostalCode(), order.getState(), order.getCity(), order.getNeighborhood(),
                order.getStreet(), order.getAddressNumber(), order.getComplement(), order.getTotal(), order.getRefundedAmount(),
                order.getStatus().name(), order.getPaymentProvider().name(), order.isPaymentVerified(),
                order.getWhatsappUrl(), canConfirmWhatsapp, canCancelWhatsapp,
                order.getPaidAt(), order.getPaymentUpdatedAt(), order.getCreatedAt(),
                order.getItems().stream().map(item -> new AdminOrderItemResponse(item.getProductName(), item.getQuantity(), item.getUnitPrice(), item.getShoeSize(), item.getColorVariant())).toList());
    }

    private static String maskCpf(String cpf) {
        return cpf == null || cpf.length() != 11 ? "***.***.***-**" : "***.***.***-" + cpf.substring(9);
    }

    public record DashboardResponse(long productsSold, long accountsCreated, BigDecimal revenue,
                                    long registeredProducts, List<ProductResponse> inventory, List<AdminOrderResponse> orders) { }
    public record AdminOrderResponse(Long id, String fullName, String email, String cpf, String paymentMethod,
                                     String postalCode, String state, String city, String neighborhood, String street,
                                     String addressNumber, String complement, BigDecimal total, BigDecimal refundedAmount,
                                     String status, String paymentProvider, boolean paymentVerified,
                                     String whatsappUrl, boolean canConfirmWhatsapp, boolean canCancelWhatsapp,
                                     java.time.Instant paidAt, java.time.Instant paymentUpdatedAt, java.time.Instant createdAt,
                                     List<AdminOrderItemResponse> items) { }
    public record AdminOrderItemResponse(String productName, Integer quantity, BigDecimal unitPrice, String shoeSize, String colorVariant) { }
}
