package com.ecommerce.hardware.controller;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** Product fields accepted in the JSON part of a multipart product upload. */
public record ProductUploadRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 60) String category,
        @NotNull @DecimalMin(value = "0.01") @Digits(integer = 8, fraction = 2) BigDecimal price,
        @NotNull @PositiveOrZero Integer stockQuantity,
        @Size(max = 2_000) String description
) {
}
