package com.ecommerce.hardware.tools;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.io.Console;
import java.util.Arrays;

/**
 * Local-only helper. It is not registered as a Spring component and is never exposed as an endpoint.
 */
public final class AdminCredentialGenerator {

    private AdminCredentialGenerator() {
    }

    public static void main(String[] args) {
        Console console = System.console();
        if (console == null) {
            throw new IllegalStateException("Run this command in an interactive terminal.");
        }

        String email = console.readLine("Admin email: ").trim();
        char[] password = console.readPassword("Admin password (at least 12 characters): ");
        char[] confirmation = console.readPassword("Confirm password: ");
        try {
            if (email.isBlank() || password.length < 12 || !Arrays.equals(password, confirmation)) {
                throw new IllegalArgumentException("Email is required, the password must have 12+ characters, and both entries must match.");
            }

            String hash = new BCryptPasswordEncoder(12).encode(new String(password));

            console.printf("%nSet these values as environment variables:%n");
            console.printf("APP_ADMIN_EMAIL=%s%n", email);
            console.printf("APP_ADMIN_PASSWORD_HASH=%s%n", hash);
        } finally {
            Arrays.fill(password, '\0');
            Arrays.fill(confirmation, '\0');
        }
    }

}
