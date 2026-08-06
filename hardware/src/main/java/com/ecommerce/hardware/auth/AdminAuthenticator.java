package com.ecommerce.hardware.auth;

import com.ecommerce.hardware.config.AdminProperties;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

@Service
public class AdminAuthenticator {

    private final AdminProperties adminProperties;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptService loginAttemptService;

    public AdminAuthenticator(AdminProperties adminProperties, PasswordEncoder passwordEncoder,
                              LoginAttemptService loginAttemptService) {
        this.adminProperties = adminProperties;
        this.passwordEncoder = passwordEncoder;
        this.loginAttemptService = loginAttemptService;
    }

    public AuthenticationResult authenticate(AdminLoginRequest login, String clientIp) {
        String normalizedEmail = login.email().trim().toLowerCase(Locale.ROOT);
        LoginAttemptService.LoginAttemptDecision preCheck = loginAttemptService.check(clientIp, normalizedEmail);
        if (!preCheck.allowed()) {
            return AuthenticationResult.rateLimited(preCheck.retryAfterSeconds());
        }

        boolean emailMatches = MessageDigest.isEqual(
                normalizedEmail.getBytes(StandardCharsets.UTF_8),
                adminProperties.normalizedEmail().getBytes(StandardCharsets.UTF_8));
        // Always run bcrypt, including for a wrong email, to reduce timing differences.
        boolean passwordMatches = passwordEncoder.matches(login.password(), adminProperties.getPasswordHash());

        if (!emailMatches || !passwordMatches) {
            LoginAttemptService.LoginAttemptDecision failure = loginAttemptService.recordFailure(clientIp, normalizedEmail);
            if (!failure.allowed()) {
                return AuthenticationResult.rateLimited(failure.retryAfterSeconds());
            }
            return AuthenticationResult.invalid(failure.delayMillis());
        }

        loginAttemptService.clearFailures(clientIp, normalizedEmail);
        return AuthenticationResult.success(adminProperties.getEmail());
    }

    public record AuthenticationResult(boolean authenticated, boolean rateLimited, String email,
                                       long delayMillis, long retryAfterSeconds) {
        static AuthenticationResult success(String email) {
            return new AuthenticationResult(true, false, email, 0, 0);
        }

        static AuthenticationResult invalid(long delayMillis) {
            return new AuthenticationResult(false, false, null, delayMillis, 0);
        }

        static AuthenticationResult rateLimited(long retryAfterSeconds) {
            return new AuthenticationResult(false, true, null, 0, retryAfterSeconds);
        }
    }
}
