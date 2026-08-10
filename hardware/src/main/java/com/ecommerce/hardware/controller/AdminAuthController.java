package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.auth.AdminAuthenticator;
import com.ecommerce.hardware.auth.AdminLoginRequest;
import com.ecommerce.hardware.auth.AdminSessionResponse;
import com.ecommerce.hardware.security.AdminAccessTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/auth")
public class AdminAuthController {

    private static final Logger LOG = LoggerFactory.getLogger(AdminAuthController.class);
    private final AdminAuthenticator adminAuthenticator;
    private final SecurityContextRepository securityContextRepository;
    private final CsrfTokenRepository csrfTokenRepository;
    private final AdminAccessTokenService accessTokenService;

    public AdminAuthController(AdminAuthenticator adminAuthenticator,
                               SecurityContextRepository securityContextRepository,
                               CsrfTokenRepository csrfTokenRepository,
                               AdminAccessTokenService accessTokenService) {
        this.adminAuthenticator = adminAuthenticator;
        this.securityContextRepository = securityContextRepository;
        this.csrfTokenRepository = csrfTokenRepository;
        this.accessTokenService = accessTokenService;
    }

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken csrfToken) {
        return Map.of("token", csrfToken.getToken());
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AdminLoginRequest login,
                                   HttpServletRequest request, HttpServletResponse response) {
        String clientIp = request.getRemoteAddr();
        AdminAuthenticator.AuthenticationResult result = adminAuthenticator.authenticate(login, clientIp);

        if (result.rateLimited()) {
            LOG.warn("Admin login rate limited: ip={}", clientIp);
            return ResponseEntity.status(429)
                    .header(HttpHeaders.RETRY_AFTER, Long.toString(result.retryAfterSeconds()))
                    .body(Map.of("message", "Muitas tentativas. Tente novamente mais tarde."));
        }

        if (!result.authenticated()) {
            applyBackoff(result.delayMillis());
            LOG.warn("Admin login failed: ip={}", clientIp);
            return ResponseEntity.status(401).body(Map.of("message", "Credenciais invalidas."));
        }

        request.getSession(true);
        request.changeSessionId();
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                result.email(), null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);
        // Rotate the CSRF token after changing authentication state.
        csrfTokenRepository.saveToken(null, request, response);

        LOG.info("Admin login succeeded: ip={}", clientIp);
        AdminAccessTokenService.IssuedToken accessToken = accessTokenService.issue(result.email());
        return ResponseEntity.ok(new AdminSessionResponse(result.email(), accessToken.value(),
                accessToken.expiresAtEpochSeconds()));
    }

    @GetMapping("/session")
    public AdminSessionResponse session(Authentication authentication) {
        return new AdminSessionResponse(authentication.getName());
    }

    private void applyBackoff(long delayMillis) {
        if (delayMillis <= 0) {
            return;
        }
        try {
            Thread.sleep(delayMillis);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }
}
