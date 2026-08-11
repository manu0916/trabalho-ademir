package com.ecommerce.hardware.service;

import com.ecommerce.hardware.config.StripeProperties;
import com.stripe.net.Webhook;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class StripePaymentGatewayTests {

    private static final String WEBHOOK_SECRET = "whsec_test_signature_secret";

    @Test
    void acceptsAValidStripeHmacSignatureAndExtractsTheRawEvent() throws Exception {
        long timestamp = Instant.now().getEpochSecond();
        String payload = checkoutCompletedPayload(timestamp);

        StripePaymentGateway.VerifiedWebhookEvent event = gateway()
                .verifyWebhook(payload, signatureHeader(payload, timestamp));

        assertEquals("evt_test_signed_12345678", event.id());
        assertEquals("checkout.session.completed", event.type());
        assertEquals("cs_test_signed_12345678", event.checkoutSessionId());
        assertEquals("pi_test_signed_12345678", event.paymentIntentId());
        assertEquals(1099L, event.amountTotal());
        assertEquals("nexus_checkout_v1", event.integration());
    }

    @Test
    void rejectsPayloadChangedAfterItWasSigned() throws Exception {
        long timestamp = Instant.now().getEpochSecond();
        String original = checkoutCompletedPayload(timestamp);
        String altered = original.replace("\"amount_total\":1099", "\"amount_total\":1199");

        assertBadRequest(() -> gateway().verifyWebhook(altered, signatureHeader(original, timestamp)));
    }

    @Test
    void rejectsAnAuthenticSignatureWithAnExpiredTimestamp() throws Exception {
        long timestamp = Instant.now().getEpochSecond() - Webhook.DEFAULT_TOLERANCE - 10;
        String payload = checkoutCompletedPayload(timestamp);

        assertBadRequest(() -> gateway().verifyWebhook(payload, signatureHeader(payload, timestamp)));
    }

    @Test
    void rejectsAWebhookWithoutTheStripeSignatureHeader() {
        String payload = checkoutCompletedPayload(Instant.now().getEpochSecond());

        assertBadRequest(() -> gateway().verifyWebhook(payload, null));
    }

    @Test
    void rejectsLiveAndTestApiKeysThatDoNotMatchTheConfiguredModeBeforeCallingStripe() {
        assertModeMismatch("sk_live_not_a_real_key_12345678", false);
        assertModeMismatch("sk_test_not_a_real_key_12345678", true);
    }

    private static StripePaymentGateway gateway() {
        StripeProperties properties = new StripeProperties();
        properties.setWebhookSecret(WEBHOOK_SECRET);
        properties.setLiveMode(false);
        return new StripePaymentGateway(properties);
    }

    private static void assertModeMismatch(String secretKey, boolean liveMode) {
        StripeProperties properties = new StripeProperties();
        properties.setSecretKey(secretKey);
        properties.setLiveMode(liveMode);
        StripePaymentGateway gateway = new StripePaymentGateway(properties);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> gateway.retrieveCheckout("cs_test_no_network_12345678"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
        assertEquals("A chave do gateway n\u00e3o corresponde ao modo Stripe configurado.", exception.getReason());
    }

    private static String signatureHeader(String payload, long timestamp) throws Exception {
        String signature = Webhook.Util.computeHmacSha256(WEBHOOK_SECRET, timestamp + "." + payload);
        return "t=" + timestamp + ",v1=" + signature;
    }

    private static void assertBadRequest(Executable call) {
        ResponseStatusException exception = assertThrows(ResponseStatusException.class, call);
        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    private static String checkoutCompletedPayload(long created) {
        return """
                {"id":"evt_test_signed_12345678","object":"event","created":%d,"livemode":false,
                "data":{"object":{"id":"cs_test_signed_12345678","object":"checkout.session",
                "client_reference_id":"11111111-1111-1111-1111-111111111111",
                "payment_intent":"pi_test_signed_12345678","payment_status":"paid","status":"complete",
                "currency":"brl","amount_total":1099,
                "metadata":{"order_reference":"11111111-1111-1111-1111-111111111111",
                "integration":"nexus_checkout_v1"}}},"type":"checkout.session.completed"}
                """.formatted(created).strip();
    }
}
