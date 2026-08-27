package com.ecommerce.hardware.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Rejects production startup when credentials or the store's WhatsApp
 * destination have not been supplied by the deployment environment.
 */
@Component
@Profile({"prod", "supabase"})
public final class ProductionStoreConfigurationValidator implements InitializingBean {

    private final AdminProperties adminProperties;
    private final StoreProperties storeProperties;

    public ProductionStoreConfigurationValidator(
            AdminProperties adminProperties,
            StoreProperties storeProperties
    ) {
        this.adminProperties = adminProperties;
        this.storeProperties = storeProperties;
    }

    @Override
    public void afterPropertiesSet() {
        List<String> invalidVariables = new ArrayList<>();

        if (adminProperties.getEmail().isBlank()) {
            invalidVariables.add("APP_ADMIN_EMAIL");
        }
        if (adminProperties.getPasswordHash().isBlank()) {
            invalidVariables.add("APP_ADMIN_PASSWORD_HASH");
        }
        if (!storeProperties.isWhatsappNumberValid()) {
            invalidVariables.add("APP_STORE_WHATSAPP_NUMBER");
        }

        if (!invalidVariables.isEmpty()) {
            throw new IllegalStateException(
                    "Missing or invalid required production environment variables: "
                            + String.join(", ", invalidVariables)
            );
        }
    }
}
