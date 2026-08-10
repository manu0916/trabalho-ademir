package com.ecommerce.hardware.security;

import com.ecommerce.hardware.config.AdminProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;

/**
 * Short-lived, signed proof of an already authenticated administrator.
 *
 * The signature uses a dedicated server-only secret. If no persistent secret is configured,
 * a cryptographically random per-process key keeps tokens safe and intentionally invalidates
 * them after a restart.
 */
@Service
public class AdminAccessTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final long TOKEN_TTL_SECONDS = 15 * 60;
    private static final int MAX_TOKEN_LENGTH = 2_048;
    private static final Logger LOG = LoggerFactory.getLogger(AdminAccessTokenService.class);

    private final AdminProperties adminProperties;
    private final byte[] signingKey;

    public AdminAccessTokenService(AdminProperties adminProperties,
                                   @Value("${app.admin.access-token-secret:}") String configuredSecret) {
        this.adminProperties = adminProperties;
        if (configuredSecret != null && !configuredSecret.isBlank()) {
            byte[] configuredKey = configuredSecret.getBytes(StandardCharsets.UTF_8);
            if (configuredKey.length < 32) {
                throw new IllegalStateException("APP_ADMIN_ACCESS_TOKEN_SECRET must contain at least 32 bytes.");
            }
            this.signingKey = configuredKey;
        } else {
            this.signingKey = new byte[32];
            new SecureRandom().nextBytes(this.signingKey);
            LOG.warn("APP_ADMIN_ACCESS_TOKEN_SECRET is not configured; admin tokens reset when this instance restarts.");
        }
    }

    public IssuedToken issue(String email) {
        long expiresAtEpochSeconds = Instant.now().getEpochSecond() + TOKEN_TTL_SECONDS;
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        String encodedEmail = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(normalizedEmail.getBytes(StandardCharsets.UTF_8));
        String payload = encodedEmail + "." + expiresAtEpochSeconds;
        return new IssuedToken(payload + "." + sign(payload), expiresAtEpochSeconds);
    }

    public Optional<String> validate(String token) {
        if (token == null || token.isBlank() || token.length() > MAX_TOKEN_LENGTH) {
            return Optional.empty();
        }

        String[] parts = token.split("\\.", -1);
        if (parts.length != 3 || parts[0].isBlank() || parts[1].isBlank() || parts[2].isBlank()) {
            return Optional.empty();
        }

        String payload = parts[0] + "." + parts[1];
        byte[] expectedSignature = sign(payload).getBytes(StandardCharsets.US_ASCII);
        byte[] providedSignature = parts[2].getBytes(StandardCharsets.US_ASCII);
        if (!MessageDigest.isEqual(expectedSignature, providedSignature)) {
            return Optional.empty();
        }

        try {
            long expiresAtEpochSeconds = Long.parseLong(parts[1]);
            if (expiresAtEpochSeconds <= Instant.now().getEpochSecond()) {
                return Optional.empty();
            }

            String email = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            return adminProperties.normalizedEmail().equals(email) ? Optional.of(email) : Optional.empty();
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(signingKey, HMAC_ALGORITHM));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to sign the administrator access token.", exception);
        }
    }

    public record IssuedToken(String value, long expiresAtEpochSeconds) {
    }
}
