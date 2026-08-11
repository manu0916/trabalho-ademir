package com.ecommerce.hardware;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupabaseProfileConfigurationTests {

    @Test
    void supabaseProfileEnforcesHttpsAndUsesNativeForwardedHeaders() throws Exception {
        Properties profile = new Properties();
        var resource = getClass().getResourceAsStream("/application-supabase.properties");
        assertNotNull(resource);
        try (var reader = new InputStreamReader(resource, StandardCharsets.UTF_8)) {
            profile.load(reader);
        }

        assertEquals("true", profile.getProperty("app.security.enforce-https"));
        assertEquals("native", profile.getProperty("server.forward-headers-strategy"));
        assertEquals("true", profile.getProperty("server.servlet.session.cookie.secure"));
    }

    @Test
    void productionSchemaContainsPaymentStateLedgersAndDataApiProtection() throws Exception {
        String schema = Files.readString(Path.of("supabase-schema.sql"), StandardCharsets.UTF_8)
                .toLowerCase(Locale.ROOT);
        for (String required : new String[] {
                "payment_state", "refund_state", "dispute_state", "checkout_status",
                "refund_attempt_amount", "purchase_orders_refund_attempt_amount_valid",
                "payment_checkout_attempts", "payment_webhook_events", "payment_refunds",
                "payment_disputes", "enable row level security", "revoke all on table"
        }) {
            assertTrue(schema.contains(required), () -> "Missing production schema contract: " + required);
        }
    }
}
