package com.ecommerce.hardware.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import java.util.ArrayList;

@Configuration
public class CorsConfig {

    // Vercel creates a unique preview hostname for every deployment of this project.
    // Restrict the wildcard to this project's own account scope rather than allowing all Vercel sites.
    private static final String VERCEL_PROJECT_PREVIEW_ORIGIN =
            "https://trabalho-ademir-*-manu0916s-projects.vercel.app";

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") String configuredOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        List<String> allowedOrigins = new ArrayList<>();
        List<String> allowedOriginPatterns = new ArrayList<>();

        Arrays.stream(configuredOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .forEach(origin -> {
                    if (origin.contains("*")) {
                        allowedOriginPatterns.add(origin);
                    } else {
                        allowedOrigins.add(origin);
                    }
                });

        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedOriginPatterns(allowedOriginPatterns);
        config.addAllowedOriginPattern(VERCEL_PROJECT_PREVIEW_ORIGIN);
        config.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN"));
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "OPTIONS"));
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
