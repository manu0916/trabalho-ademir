package com.ecommerce.hardware.config;

import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Store-level configuration that is independent of any payment gateway.
 * Production profiles add a non-blank requirement through
 * {@link ProductionStoreConfigurationValidator}.
 */
@Validated
@ConfigurationProperties(prefix = "app.store")
public class StoreProperties {

    /**
     * WhatsApp destination number in international format with country code (DDI).
     * Accepted pattern: 10–15 digits, no spaces, no dashes, no '+'.
     * Required in production. Local development can leave it blank to keep
     * WhatsApp checkout disabled.
     */
    @Pattern(regexp = "^$|^\\d{10,15}$",
            message = "must be blank or contain 10 to 15 digits")
    private String whatsappNumber = "";

    /**
     * Minutes after which a PENDING_PAYMENT WhatsApp order is automatically cancelled
     * and its reserved stock is returned to available inventory.
     * Defaults to 60 minutes.
     */
    private int whatsappExpiryMinutes = 60;

    public String getWhatsappNumber() { return whatsappNumber; }
    public void setWhatsappNumber(String whatsappNumber) {
        this.whatsappNumber = whatsappNumber == null ? "" : whatsappNumber;
    }

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
