package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.HeroMode;

import java.util.List;

public record StorefrontHeroResponse(HeroMode mode, Integer intervalSeconds,
                                     List<ManualHeroImageResponse> manualImages) {

    public record ManualHeroImageResponse(Long id, String imageUrl, String altText, Integer sortOrder) {
    }
}
