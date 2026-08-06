package com.ecommerce.hardware.security;

import com.ecommerce.hardware.config.SecurityProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ApiRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_TRACKED_CLIENTS = 10_000;
    private final ConcurrentHashMap<String, Deque<Instant>> requests = new ConcurrentHashMap<>();
    private final SecurityProperties securityProperties;

    public ApiRateLimitFilter(SecurityProperties securityProperties) {
        this.securityProperties = securityProperties;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/") || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String clientIp = request.getRemoteAddr();
        if (!withinLimit(clientIp)) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", "60");
            response.getWriter().write("{\"message\":\"Solicitacao temporariamente limitada.\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean withinLimit(String clientIp) {
        if (requests.size() >= MAX_TRACKED_CLIENTS && !requests.containsKey(clientIp)) {
            requests.keySet().stream().findAny().ifPresent(requests::remove);
        }

        Deque<Instant> window = requests.computeIfAbsent(clientIp, ignored -> new ArrayDeque<>());
        Instant cutoff = Instant.now().minusSeconds(60);
        synchronized (window) {
            while (!window.isEmpty() && window.peekFirst().isBefore(cutoff)) {
                window.removeFirst();
            }
            if (window.size() >= securityProperties.getApiRateLimitPerMinute()) {
                return false;
            }
            window.addLast(Instant.now());
            return true;
        }
    }
}
