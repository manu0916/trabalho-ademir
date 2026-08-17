package com.ecommerce.hardware.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "storefront_hero_settings")
@Getter
@Setter
@NoArgsConstructor
public class StorefrontHeroSettings {

    public static final int SINGLETON_ID = 1;
    public static final int DEFAULT_INTERVAL_SECONDS = 5;

    @Id
    private Integer id = SINGLETON_ID;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private HeroMode mode = HeroMode.PRODUCTS;

    @Column(nullable = false)
    private Integer intervalSeconds = DEFAULT_INTERVAL_SECONDS;

    @Version
    @Column(nullable = false)
    private Long version;
}
