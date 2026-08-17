package com.ecommerce.hardware.model;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/** Categories offered by the current sports-shoe catalog. */
public enum ProductCategory {

    BASQUETE("Basquete", "basquete", "basketball"),
    VOLEI("Vôlei", "volei", "volleyball"),
    HANDBALL("Handball", "handball", "handebol"),
    FUTSAL("Futsal", "futsal"),
    FUTEBOL("Futebol", "futebol", "football", "soccer");

    private final String label;
    private final Set<String> normalizedAliases;

    ProductCategory(String label, String... aliases) {
        this.label = label;
        this.normalizedAliases = Arrays.stream(aliases)
                .map(ProductCategory::normalize)
                .collect(Collectors.toUnmodifiableSet());
    }

    public String label() {
        return label;
    }

    /**
     * Resolves case-insensitive labels and their supported aliases. Diacritics do
     * not change the match, so both "Vôlei" and "volei" produce the same value.
     */
    public static Optional<ProductCategory> fromInput(String value) {
        if (value == null || value.isBlank()) return Optional.empty();
        String candidate = normalize(value);
        return Arrays.stream(values())
                .filter(category -> category.normalizedAliases.contains(candidate))
                .findFirst();
    }

    public static String allowedLabels() {
        return "Basquete, Vôlei, Handball, Futsal ou Futebol";
    }

    private static String normalize(String value) {
        String withoutDiacritics = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return withoutDiacritics.toLowerCase(Locale.ROOT);
    }
}
