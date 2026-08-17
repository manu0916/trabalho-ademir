package com.ecommerce.hardware.controller;

import java.math.BigDecimal;
import java.util.List;

public record ProductResponse(Long id, String name, String category, BigDecimal price,
                              Integer stockQuantity, String description, String imageUrl,
                              List<ProductImageResponse> images) {

    public record ProductImageResponse(Long id, String imageUrl, Integer sortOrder) {
    }
}
