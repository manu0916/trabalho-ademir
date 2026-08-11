package com.ecommerce.hardware.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.security")
public class SecurityProperties {

    private boolean enforceHttps;

    @Min(30)
    @Max(10_000)
    private int apiRateLimitPerMinute = 120;

    @Min(60)
    @Max(10_000)
    private int paymentStatusRateLimitPerMinute = 240;

    @Min(60)
    @Max(10_000)
    private int webhookRateLimitPerMinute = 600;

    public boolean isEnforceHttps() {
        return enforceHttps;
    }

    public void setEnforceHttps(boolean enforceHttps) {
        this.enforceHttps = enforceHttps;
    }

    public int getApiRateLimitPerMinute() {
        return apiRateLimitPerMinute;
    }

    public void setApiRateLimitPerMinute(int apiRateLimitPerMinute) {
        this.apiRateLimitPerMinute = apiRateLimitPerMinute;
    }

    public int getPaymentStatusRateLimitPerMinute() { return paymentStatusRateLimitPerMinute; }
    public void setPaymentStatusRateLimitPerMinute(int value) { this.paymentStatusRateLimitPerMinute = value; }
    public int getWebhookRateLimitPerMinute() { return webhookRateLimitPerMinute; }
    public void setWebhookRateLimitPerMinute(int value) { this.webhookRateLimitPerMinute = value; }
}
