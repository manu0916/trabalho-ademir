package com.ecommerce.hardware.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

/** Latest signed state for one Stripe dispute. A charge can have more than one dispute. */
@Entity
@Table(name = "payment_disputes")
public class PaymentDispute {
    @Id
    @Column(name = "dispute_id", length = 255)
    private String disputeId;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false, length = 40)
    private String status;

    @Column(name = "last_event_created", nullable = false)
    private long lastEventCreated;

    @Column(name = "last_event_rank", nullable = false)
    private int lastEventRank;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected PaymentDispute() {
    }

    public PaymentDispute(String disputeId, Long orderId, BigDecimal amount, String currency,
                          String status, long eventCreated, int eventRank) {
        this.disputeId = disputeId;
        this.orderId = orderId;
        this.amount = amount;
        this.currency = currency;
        this.status = status;
        this.lastEventCreated = eventCreated;
        this.lastEventRank = eventRank;
    }

    public boolean apply(BigDecimal amount, String currency, String status, long eventCreated, int eventRank) {
        if (eventCreated < lastEventCreated
                || eventCreated == lastEventCreated && eventRank < lastEventRank) return false;
        if (isClosed(this.status) && !isClosed(status)) return false;
        this.amount = amount;
        this.currency = currency;
        this.status = status;
        this.lastEventCreated = eventCreated;
        this.lastEventRank = eventRank;
        this.updatedAt = Instant.now();
        return true;
    }

    private static boolean isClosed(String status) {
        return "won".equals(status) || "lost".equals(status)
                || "warning_closed".equals(status) || "prevented".equals(status);
    }

    public Long getOrderId() { return orderId; }
    public String getDisputeId() { return disputeId; }
    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
    public String getStatus() { return status; }
}
