package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.Product;

import java.math.BigDecimal;

public record ProductResponse(Long id, String name, String category, BigDecimal price,
                              Integer stockQuantity, String description, String imageUrl) {

    static ProductResponse from(Product product) {
        return new ProductResponse(product.getId(), product.getName(), product.getCategory(), product.getPrice(),
                product.getStockQuantity(), product.getDescription(), product.getImageUrl());
    }
}
