package com.ecommerce.hardware.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/** Restores an administrator identity when a reverse proxy cannot reliably preserve a session cookie. */
public class AdminBearerAuthenticationFilter extends OncePerRequestFilter {

    private final AdminAccessTokenService accessTokenService;

    public AdminBearerAuthenticationFilter(AdminAccessTokenService accessTokenService) {
        this.accessTokenService = accessTokenService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        Optional<String> authenticatedAdmin = Optional.empty();
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String token = authorization.substring(7).trim();
            authenticatedAdmin = accessTokenService.validate(token);
            authenticatedAdmin.ifPresent(email -> {
                UsernamePasswordAuthenticationToken authentication =
                        UsernamePasswordAuthenticationToken.authenticated(email, null,
                                List.of(
                                        new SimpleGrantedAuthority("ROLE_ADMIN"),
                                        new SimpleGrantedAuthority("ROLE_ADMIN_BEARER")));
                SecurityContext context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(authentication);
                SecurityContextHolder.setContext(context);
            });
        }

        // Product writes use a signed, short-lived bearer instead of the browser session.
        // Enforce it here, before MVC parses or persists the request, and let the authorization
        // rules permit only requests that have already passed this guard.
        if (isProductWrite(request) && authenticatedAdmin.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"message\":\"Acesso negado.\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isProductWrite(HttpServletRequest request) {
        String method = request.getMethod();
        if (!("POST".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method))) {
            return false;
        }
        String path = request.getRequestURI();
        return "/api/products".equals(path) || path.startsWith("/api/products/");
    }
}
