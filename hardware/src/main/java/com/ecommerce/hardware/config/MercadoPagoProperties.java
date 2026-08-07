package com.ecommerce.hardware.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.mercado-pago")
public class MercadoPagoProperties {
    /** Secret server-side token. It must never be sent to the browser. */
    private String accessToken;
    /** Public HTTPS endpoint that Mercado Pago calls after a payment update. */
    private String webhookUrl;
    private String successUrl;
    private String failureUrl;
    private String pendingUrl;

    public String getAccessToken() { return accessToken; }
    public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
    public String getWebhookUrl() { return webhookUrl; }
    public void setWebhookUrl(String webhookUrl) { this.webhookUrl = webhookUrl; }
    public String getSuccessUrl() { return successUrl; }
    public void setSuccessUrl(String successUrl) { this.successUrl = successUrl; }
    public String getFailureUrl() { return failureUrl; }
    public void setFailureUrl(String failureUrl) { this.failureUrl = failureUrl; }
    public String getPendingUrl() { return pendingUrl; }
    public void setPendingUrl(String pendingUrl) { this.pendingUrl = pendingUrl; }
}
