package com.ecommerce.hardware.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "payment_webhook_events")
public class PaymentWebhookEvent {

    @Id
    @Column(length = 255)
    private String id;

    @Column(name = "event_type", nullable = false, length = 100)
    private String eventType;

    @Column(name = "object_id", length = 255)
    private String objectId;

    @Column(name = "processed_at", nullable = false, updatable = false)
    private Instant processedAt = Instant.now();

    protected PaymentWebhookEvent() {
    }

    public PaymentWebhookEvent(String id, String eventType, String objectId) {
        this.id = id;
        this.eventType = eventType;
        this.objectId = objectId;
    }

    public String getId() { return id; }
    public String getEventType() { return eventType; }
    public String getObjectId() { return objectId; }
    public Instant getProcessedAt() { return processedAt; }
}
