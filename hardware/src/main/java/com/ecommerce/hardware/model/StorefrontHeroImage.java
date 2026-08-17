package com.ecommerce.hardware.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "storefront_hero_images", uniqueConstraints = {
        @UniqueConstraint(name = "storefront_hero_images_position_unique",
                columnNames = {"settings_id", "sort_order"})
})
@Getter
@Setter
@NoArgsConstructor
public class StorefrontHeroImage {

    /** Base64 expansion of the largest accepted two-megabyte upload is 2,796,204 characters. */
    public static final int MAX_BASE64_LENGTH = 2_800_000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Integer settingsId = StorefrontHeroSettings.SINGLETON_ID;

    @Column(nullable = false, length = 16)
    private String contentType;

    @Column(nullable = false)
    private Integer byteSize;

    @Column(nullable = false, length = MAX_BASE64_LENGTH)
    private String imageBase64;

    @Column(nullable = false, length = 160)
    private String altText;

    @Column(nullable = false)
    private Integer sortOrder;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
