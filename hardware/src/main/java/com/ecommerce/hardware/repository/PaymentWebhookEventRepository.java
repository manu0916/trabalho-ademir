package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.PaymentWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentWebhookEventRepository extends JpaRepository<PaymentWebhookEvent, String> {
}
