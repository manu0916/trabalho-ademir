package com.ecommerce.hardware.controller;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ProductStockRequest(@NotNull @PositiveOrZero Integer stockQuantity) {
}
