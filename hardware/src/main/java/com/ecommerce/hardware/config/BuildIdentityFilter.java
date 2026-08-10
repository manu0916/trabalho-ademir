package com.ecommerce.hardware.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Adds the deployed Git revision to responses so stale Docker images are immediately visible. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class BuildIdentityFilter extends OncePerRequestFilter {

    private final String revision;

    public BuildIdentityFilter(@Value("${RENDER_GIT_COMMIT:local}") String revision) {
        String normalized = revision == null ? "local" : revision.trim();
        this.revision = normalized.matches("[A-Fa-f0-9]{7,40}")
                ? normalized.substring(0, Math.min(normalized.length(), 12))
                : "local";
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        response.setHeader("X-Nexus-Backend-Commit", revision);
        filterChain.doFilter(request, response);
    }
}
