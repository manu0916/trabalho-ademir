package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.HeroMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Every field is optional so PATCH can update settings or the ordered image metadata independently. */
public record StorefrontHeroUpdateRequest(
        HeroMode mode,
        @Min(3) @Max(30) Integer intervalSeconds,
        @Size(max = 8) List<@NotNull @Valid ManualImageUpdate> manualImages
) {

    public record ManualImageUpdate(
            @NotNull @Positive Long id,
            @Size(max = 160) String altText
    ) {
    }
}
