package com.ecommerce.hardware.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Store-level configuration that is independent of any payment gateway.
 * Every field that has a non-blank validation requirement must be provided
 * through an environment variable before the application accepts traffic.
 */
@ConfigurationProperties(prefix = "app.store")
public class StoreProperties {

    /**
     * WhatsApp destination number in international format with country code (DDI).
     * Accepted pattern: 10–15 digits, no spaces, no dashes, no '+'.
     * Example: 5535991526318  (Brazil DDI 55 + area code + number)
     * Required. The application fails to start checkout for WHATSAPP orders when absent or invalid.
     */
    private String whatsappNumber;

    /**
     * Minutes after which a PENDING_PAYMENT WhatsApp order is automatically cancelled
     * and its reserved stock is returned to available inventory.
     * Defaults to 60 minutes.
     */
    private int whatsappExpiryMinutes = 60;

    public String getWhatsappNumber() { return whatsappNumber; }
    public void setWhatsappNumber(String whatsappNumber) { this.whatsappNumber = whatsappNumber; }

    public int getWhatsappExpiryMinutes() { return whatsappExpiryMinutes; }
    public void setWhatsappExpiryMinutes(int whatsappExpiryMinutes) {
        this.whatsappExpiryMinutes = whatsappExpiryMinutes;
    }

    /**
     * Returns true when the configured number is a syntactically valid international
     * WhatsApp number (10–15 digits with no symbols). This does NOT verify whether
     * the number is registered on WhatsApp.
     */
    public boolean isWhatsappNumberValid() {
        return whatsappNumber != null && whatsappNumber.matches("^\\d{10,15}$");
    }
}
