package com.ecommerce.hardware.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Durable database mutex and audit record for one browser idempotency key. */
@Entity
@Table(name = "payment_checkout_attempts")
public class PaymentCheckoutAttempt {
    @Id
    @Column(name = "idempotency_key", length = 36)
    private String idempotencyKey;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(name = "order_id")
    private Long orderId;

    @Column(nullable = false, length = 20)
    private String state = "NEW";

    @Column(name = "lease_token", length = 36)
    private String leaseToken;

    @Column(name = "lease_expires_at")
    private Instant leaseExpiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected PaymentCheckoutAttempt() {
    }

    public PaymentCheckoutAttempt(String idempotencyKey, Long customerId, String requestHash) {
        this.idempotencyKey = idempotencyKey;
        this.customerId = customerId;
        this.requestHash = requestHash;
    }

    public void attachOrder(Long orderId) {
        this.orderId = orderId;
        this.updatedAt = Instant.now();
    }

    public boolean creationInProgress(Instant now) {
        return "CREATING".equals(state) && leaseExpiresAt != null && leaseExpiresAt.isAfter(now);
    }

    public void beginCreation(String token, Instant expiresAt) {
        this.state = "CREATING";
        this.leaseToken = token;
        this.leaseExpiresAt = expiresAt;
        this.updatedAt = Instant.now();
    }

    public boolean ownsLease(String token) {
        return token != null && token.equals(leaseToken);
    }

    public void markReady() {
        this.state = "READY";
        clearLease();
    }

    public void markUnknown() {
        this.state = "UNKNOWN";
        clearLease();
    }

    public void markFailed() {
        this.state = "FAILED";
        clearLease();
    }

    private void clearLease() {
        this.leaseToken = null;
        this.leaseExpiresAt = null;
        this.updatedAt = Instant.now();
    }

    public String getIdempotencyKey() { return idempotencyKey; }
    public Long getCustomerId() { return customerId; }
    public String getRequestHash() { return requestHash; }
    public Long getOrderId() { return orderId; }
    public String getState() { return state; }
    public String getLeaseToken() { return leaseToken; }
    public Instant getLeaseExpiresAt() { return leaseExpiresAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
