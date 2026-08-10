package com.ecommerce.hardware.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final String revision;

    public HealthController(@Value("${RENDER_GIT_COMMIT:local}") String revision) {
        this.revision = revision == null || revision.isBlank() ? "local" : revision.trim();
    }

    @GetMapping
    public Map<String, String> health() {
        return Map.of("status", "ok", "commit", revision);
    }
}
