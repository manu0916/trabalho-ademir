package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.service.StorefrontFooterService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/storefront/footer")
public class StorefrontFooterController {

    private final StorefrontFooterService footerService;

    public StorefrontFooterController(StorefrontFooterService footerService) {
        this.footerService = footerService;
    }

    @GetMapping
    public StorefrontFooterResponse configuration() {
        return footerService.getConfiguration();
    }

    @PatchMapping
    public StorefrontFooterResponse updateConfiguration(
            @Valid @RequestBody StorefrontFooterUpdateRequest request) {
        return footerService.updateConfiguration(request);
    }
}
