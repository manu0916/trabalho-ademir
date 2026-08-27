package com.ecommerce.hardware;

import com.ecommerce.hardware.config.AdminProperties;
import com.ecommerce.hardware.config.ProductionStoreConfigurationValidator;
import com.ecommerce.hardware.config.StoreProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class ProductionStoreConfigurationTests {

    private static final String SYNTACTICALLY_VALID_TEST_HASH = "$2b$10$" + ".".repeat(53);

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfiguration.class);

    @Test
    void prodProfileRejectsBlankRequiredValuesAndNamesEveryEnvironmentVariable() {
        contextRunner
                .withPropertyValues(
                        "spring.profiles.active=prod",
                        "app.admin.email=",
                        "app.admin.password-hash=",
                        "app.store.whatsapp-number="
                )
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasStackTraceContaining("APP_ADMIN_EMAIL")
                            .hasStackTraceContaining("APP_ADMIN_PASSWORD_HASH")
                            .hasStackTraceContaining("APP_STORE_WHATSAPP_NUMBER");
                });
    }

    @Test
    void supabaseProfileUsesTheSameFailClosedValidation() {
        contextRunner
                .withPropertyValues(
                        "spring.profiles.active=supabase",
                        "app.admin.email=",
                        "app.admin.password-hash=",
                        "app.store.whatsapp-number="
                )
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void prodProfileStartsWhenAllRequiredValuesAreValid() {
        contextRunner
                .withPropertyValues(
                        "spring.profiles.active=prod",
                        "app.admin.email=admin@example.test",
                        "app.admin.password-hash=" + SYNTACTICALLY_VALID_TEST_HASH,
                        "app.store.whatsapp-number=9999999999"
                )
                .run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    void malformedProductionValuesAreRejectedByConfigurationBinding() {
        contextRunner
                .withPropertyValues(
                        "spring.profiles.active=prod",
                        "app.admin.email=not-an-email",
                        "app.admin.password-hash=not-a-bcrypt-hash",
                        "app.store.whatsapp-number=not-a-number"
                )
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void localProfileStartsWithAdminAndWhatsappFeaturesDisabled() {
        contextRunner
                .withPropertyValues(
                        "spring.profiles.active=local",
                        "app.admin.email=",
                        "app.admin.password-hash=",
                        "app.store.whatsapp-number="
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).doesNotHaveBean(ProductionStoreConfigurationValidator.class);
                });
    }

    @Test
    void packagedProfilesContainNoCredentialOrWhatsappFallbacks() throws Exception {
        Properties base = loadProperties("/application.properties");
        assertNull(base.getProperty("app.admin.email"));
        assertNull(base.getProperty("app.admin.password-hash"));
        assertNull(base.getProperty("app.store.whatsapp-number"));

        Properties local = loadProperties("/application-local.properties");
        assertEquals("${APP_ADMIN_EMAIL:}", local.getProperty("app.admin.email"));
        assertEquals("${APP_ADMIN_PASSWORD_HASH:}", local.getProperty("app.admin.password-hash"));
        assertEquals("${APP_STORE_WHATSAPP_NUMBER:}", local.getProperty("app.store.whatsapp-number"));

        Properties test = loadProperties("/application-test.properties");
        assertEquals("", test.getProperty("app.admin.email"));
        assertEquals("", test.getProperty("app.admin.password-hash"));
        assertEquals("", test.getProperty("app.store.whatsapp-number"));

        for (String profile : new String[] {"prod", "supabase"}) {
            Properties production = loadProperties("/application-" + profile + ".properties");
            assertEquals("${APP_ADMIN_EMAIL}", production.getProperty("app.admin.email"));
            assertEquals("${APP_ADMIN_PASSWORD_HASH}", production.getProperty("app.admin.password-hash"));
            assertEquals("${APP_STORE_WHATSAPP_NUMBER}", production.getProperty("app.store.whatsapp-number"));
        }
    }

    private Properties loadProperties(String path) throws Exception {
        Properties properties = new Properties();
        var resource = getClass().getResourceAsStream(path);
        assertNotNull(resource);
        try (var reader = new InputStreamReader(resource, StandardCharsets.UTF_8)) {
            properties.load(reader);
        }
        return properties;
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties({AdminProperties.class, StoreProperties.class})
    @Import(ProductionStoreConfigurationValidator.class)
    static class TestConfiguration {
    }
}
