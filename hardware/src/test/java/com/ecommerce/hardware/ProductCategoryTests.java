package com.ecommerce.hardware;

import com.ecommerce.hardware.model.ProductCategory;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductCategoryTests {

    @Test
    void supportedLabelsAndAliasesResolveToCanonicalStorefrontLabels() {
        Map<String, String> cases = Map.ofEntries(
                Map.entry("basquete", "Basquete"),
                Map.entry("BASQUETE", "Basquete"),
                Map.entry("Vôlei", "Vôlei"),
                Map.entry(" volei ", "Vôlei"),
                Map.entry("handball", "Handball"),
                Map.entry("Handebol", "Handball"),
                Map.entry("futsal", "Futsal"),
                Map.entry("FUTEBOL", "Futebol")
        );

        cases.forEach((input, expected) -> assertEquals(expected,
                ProductCategory.fromInput(input).orElseThrow().label()));
    }

    @Test
    void blankAndUnknownCategoriesDoNotResolve() {
        assertTrue(ProductCategory.fromInput(null).isEmpty());
        assertTrue(ProductCategory.fromInput("  ").isEmpty());
        assertTrue(ProductCategory.fromInput("Tênis").isEmpty());
    }
}
