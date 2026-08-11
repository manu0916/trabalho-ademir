package com.ecommerce.hardware.security;

import com.ecommerce.hardware.config.SecurityProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

public class ApiRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_TRACKED_CLIENTS = 10_000;
    private final ConcurrentHashMap<String, Deque<Instant>> requests = new ConcurrentHashMap<>();
    private final SecurityProperties securityProperties;

    public ApiRateLimitFilter(SecurityProperties securityProperties) {
        this.securityProperties = securityProperties;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/")
                || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean webhook = "/api/payments/stripe/webhook".equals(path);
        if (webhook && request.getContentLengthLong() > StripeWebhookBodyLimitFilter.MAX_WEBHOOK_BYTES) {
            StripeWebhookBodyLimitFilter.rejectPayloadTooLarge(response);
            return;
        }

        boolean statusPolling = path.startsWith("/api/customer/payments/status")
                || path.matches("/api/customer/payments/orders/[^/]+/status");
        int limit = webhook ? securityProperties.getWebhookRateLimitPerMinute()
                : statusPolling ? securityProperties.getPaymentStatusRateLimitPerMinute()
                : securityProperties.getApiRateLimitPerMinute();
        String bucket = webhook ? "webhook" : statusPolling ? "payment-status" : "api";
        boolean customerAuthentication = "POST".equalsIgnoreCase(request.getMethod())
                && path.startsWith("/api/customer/auth/");
        String client = webhook || customerAuthentication || request.getSession(false) == null
                ? request.getRemoteAddr() : "session:" + request.getSession(false).getId();
        if (!withinLimit(bucket + ':' + client, limit)) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", "60");
            response.getWriter().write("{\"message\":\"Solicitacao temporariamente limitada.\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean withinLimit(String clientKey, int limit) {
        if (requests.size() >= MAX_TRACKED_CLIENTS && !requests.containsKey(clientKey)) {
            requests.keySet().stream().findAny().ifPresent(requests::remove);
        }

        Deque<Instant> window = requests.computeIfAbsent(clientKey, ignored -> new ArrayDeque<>());
        Instant cutoff = Instant.now().minusSeconds(60);
        synchronized (window) {
            while (!window.isEmpty() && window.peekFirst().isBefore(cutoff)) {
                window.removeFirst();
            }
            if (window.size() >= limit) {
                return false;
            }
            window.addLast(Instant.now());
            return true;
        }
    }
}
