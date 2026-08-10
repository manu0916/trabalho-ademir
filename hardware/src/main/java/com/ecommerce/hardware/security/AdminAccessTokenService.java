package com.ecommerce.hardware.security;

import com.ecommerce.hardware.config.AdminProperties;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;

/**
 * Short-lived, signed proof of an already authenticated administrator.
 *
 * The signature key is derived from the server-only administrator password hash, so the token
 * cannot be forged by the browser and is invalidated automatically if that password changes.
 */
@Service
public class AdminAccessTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final long TOKEN_TTL_SECONDS = 15 * 60;
    private static final int MAX_TOKEN_LENGTH = 2_048;

    private final AdminProperties adminProperties;

    public AdminAccessTokenService(AdminProperties adminProperties) {
        this.adminProperties = adminProperties;
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
            byte[] secret = ("nexus-admin-access-v1:" + adminProperties.getPasswordHash())
                    .getBytes(StandardCharsets.UTF_8);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to sign the administrator access token.", exception);
        }
    }

    public record IssuedToken(String value, long expiresAtEpochSeconds) {
    }
}
