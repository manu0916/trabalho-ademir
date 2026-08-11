package com.ecommerce.hardware.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

/** One provider refund. The order total is derived only from rows whose latest status succeeded. */
@Entity
@Table(name = "payment_refunds")
public class PaymentRefund {
    @Id
    @Column(name = "refund_id", length = 255)
    private String refundId;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "attempt_id", length = 36)
    private String attemptId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "last_event_created", nullable = false)
    private long lastEventCreated;

    @Column(name = "last_event_rank", nullable = false)
    private int lastEventRank;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected PaymentRefund() {
    }

    public PaymentRefund(String refundId, Long orderId, String attemptId, BigDecimal amount,
                         String currency, String status, long eventCreated, int eventRank) {
        this.refundId = refundId;
        this.orderId = orderId;
        this.attemptId = attemptId;
        this.amount = amount;
        this.currency = currency;
        this.status = status;
        this.lastEventCreated = eventCreated;
        this.lastEventRank = eventRank;
    }

    public boolean apply(String attemptId, BigDecimal amount, String currency, String status,
                         long eventCreated, int eventRank) {
        if (eventCreated < lastEventCreated
                || eventCreated == lastEventCreated && eventRank < lastEventRank) return false;
        if (!allowsTransition(this.status, status)) return false;
        if (this.attemptId == null && attemptId != null) this.attemptId = attemptId;
        this.amount = amount;
        this.currency = currency;
        this.status = status;
        this.lastEventCreated = eventCreated;
        this.lastEventRank = eventRank;
        this.updatedAt = Instant.now();
        return true;
    }

    /** Applies a current provider snapshot without moving the webhook ordering cursor into the future. */
    public boolean reconcile(BigDecimal amount, String currency, String status) {
        if (!allowsTransition(this.status, status)) return false;
        this.amount = amount;
        this.currency = currency;
        this.status = status;
        this.updatedAt = Instant.now();
        return true;
    }

    private static boolean allowsTransition(String current, String next) {
        if (current == null || current.equals(next)) return true;
        if ("failed".equals(current) || "canceled".equals(current)) return false;
        if ("succeeded".equals(current)) return "failed".equals(next) || "canceled".equals(next);
        return true;
    }

    public String getRefundId() { return refundId; }
    public Long getOrderId() { return orderId; }
    public String getAttemptId() { return attemptId; }
    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
    public String getStatus() { return status; }
    public long getLastEventCreated() { return lastEventCreated; }
    public Instant getUpdatedAt() { return updatedAt; }
}
