package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import java.math.BigDecimal;
import java.util.List;
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
    public DashboardResponse dashboard() {
        List<PurchaseOrder> paidOrders = orders.findByStatus("PAID");
        long productsSold = paidOrders.stream().flatMap(order -> order.getItems().stream())
                .mapToLong(item -> item.getQuantity()).sum();
        BigDecimal revenue = paidOrders.stream().map(PurchaseOrder::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<ProductResponse> inventory = products.findAllByOrderByIdDesc().stream().map(ProductResponse::from).toList();
        return new DashboardResponse(productsSold, customers.count(), revenue, inventory.size(), inventory);
    }

    public record DashboardResponse(long productsSold, long accountsCreated, BigDecimal revenue,
                                    long registeredProducts, List<ProductResponse> inventory) { }
}
