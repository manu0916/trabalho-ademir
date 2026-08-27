package com.ecommerce.hardware.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "stock_alerts")
public class StockAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "product_name", nullable = false, length = 200)
    private String productName;

    @Column(name = "size", nullable = false, length = 20)
    private String size;

    @Column(name = "color", nullable = false, length = 80)
    private String color;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(length = 30)
    private String whatsapp;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING | NOTIFIED

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public StockAlert() {
    }

    public StockAlert(Long productId, String productName, String size, String color, String email, String whatsapp) {
        this.productId = productId;
        this.productName = productName != null ? productName.trim() : "";
        this.size = size != null ? size.trim() : "";
        this.color = color != null ? color.trim() : "";
        this.email = email != null ? email.trim().toLowerCase() : "";
        this.whatsapp = whatsapp != null && !whatsapp.isBlank() ? whatsapp.trim() : null;
        this.status = "PENDING";
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getProductId() {
        return productId;
    }

    public String getProductName() {
        return productName;
    }

    public String getSize() {
        return size;
    }

    public String getColor() {
        return color;
    }

    public String getEmail() {
        return email;
    }

    public String getWhatsapp() {
        return whatsapp;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
