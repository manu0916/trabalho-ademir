package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.service.PaymentService;
import com.ecommerce.hardware.service.WhatsappCheckoutService;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only actions for WHATSAPP orders.
 *
 * <p>All endpoints under {@code /api/admin/orders/**} are already secured by
 * {@code SecurityConfig} to require {@code ROLE_ADMIN_BEARER}. No additional
 * security annotations are needed here.
 */
@RestController
@RequestMapping("/api/admin/orders")
public class WhatsappAdminController {

    private final WhatsappCheckoutService whatsappCheckout;

    public WhatsappAdminController(WhatsappCheckoutService whatsappCheckout) {
        this.whatsappCheckout = whatsappCheckout;
    }

    /**
     * Confirms that a WhatsApp payment was manually received by the store owner.
     * Records the full capture, commits inventory, and transitions the order to PAID.
     * Idempotent: safe to call multiple times.
     */
    @PostMapping("/{orderId}/confirm-whatsapp-payment")
    public PaymentService.PaymentView confirmPayment(@PathVariable Long orderId) {
        return whatsappCheckout.confirmPayment(orderId);
    }

    /**
     * Cancels a pending WhatsApp order and releases the reserved inventory.
     * Idempotent: returns the current view if the order is already in a terminal state.
     */
    @PostMapping("/{orderId}/cancel-whatsapp-order")
    public PaymentService.PaymentView cancelOrder(@PathVariable Long orderId) {
        return whatsappCheckout.cancelOrder(orderId);
    }
}
