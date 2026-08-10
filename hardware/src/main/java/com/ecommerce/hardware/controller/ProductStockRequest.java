package com.ecommerce.hardware.controller;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record ProductStockRequest(
        @NotNull @PositiveOrZero Integer stockQuantity,
        @Size(max = 2_048) String adminAccessToken
) {
}
