package com.ecommerce.hardware.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.stripe")
public class StripeProperties {
    /** Secret server-side key. It must never be sent to the browser or written to logs. */
    private String secretKey;
    /** Signing secret for this exact webhook endpoint (CLI and production secrets differ). */
    private String webhookSecret;
    private String successUrl;
    private String cancelUrl;
    private int checkoutExpiresMinutes = 30;
    private int pixExpiresMinutes = 30;
    private int boletoExpiresDays = 1;
    private boolean liveMode;
    private long reconciliationIntervalMs = 60_000;
    private String enabledPaymentMethods = "CARTAO_CREDITO,BOLETO";

    public String getSecretKey() { return secretKey; }
    public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
    public String getWebhookSecret() { return webhookSecret; }
    public void setWebhookSecret(String webhookSecret) { this.webhookSecret = webhookSecret; }
    public String getSuccessUrl() { return successUrl; }
    public void setSuccessUrl(String successUrl) { this.successUrl = successUrl; }
    public String getCancelUrl() { return cancelUrl; }
    public void setCancelUrl(String cancelUrl) { this.cancelUrl = cancelUrl; }
    public int getCheckoutExpiresMinutes() { return checkoutExpiresMinutes; }
    public void setCheckoutExpiresMinutes(int checkoutExpiresMinutes) {
        this.checkoutExpiresMinutes = checkoutExpiresMinutes;
    }
    public int getPixExpiresMinutes() { return pixExpiresMinutes; }
    public void setPixExpiresMinutes(int pixExpiresMinutes) { this.pixExpiresMinutes = pixExpiresMinutes; }
    public int getBoletoExpiresDays() { return boletoExpiresDays; }
    public void setBoletoExpiresDays(int boletoExpiresDays) { this.boletoExpiresDays = boletoExpiresDays; }
    public boolean isLiveMode() { return liveMode; }
    public void setLiveMode(boolean liveMode) { this.liveMode = liveMode; }
    public long getReconciliationIntervalMs() { return reconciliationIntervalMs; }
    public void setReconciliationIntervalMs(long reconciliationIntervalMs) {
        this.reconciliationIntervalMs = reconciliationIntervalMs;
    }
    public String getEnabledPaymentMethods() { return enabledPaymentMethods; }
    public void setEnabledPaymentMethods(String enabledPaymentMethods) {
        this.enabledPaymentMethods = enabledPaymentMethods;
    }
}
