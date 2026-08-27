package com.ecommerce.hardware.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "storefront_footer_settings")
@Getter
@Setter
@NoArgsConstructor
public class StorefrontFooterSettings {

    public static final int SINGLETON_ID = 1;

    @Id
    private Integer id = SINGLETON_ID;

    @Column(nullable = false, length = 100)
    private String wordmark = "KICKS STORE";

    @Column(nullable = false, length = 255)
    private String brandTagline = "Calce a felicidade. Viva o seu ritmo.";

    @Column(nullable = false, length = 100)
    private String locationTitle = "";

    @Column(nullable = false, length = 255)
    private String addressLine1 = "";

    @Column(nullable = false, length = 255)
    private String addressLine2 = "";

    @Column(nullable = false, length = 100)
    private String hoursTitle = "";

    @Column(nullable = false, length = 255)
    private String storeHoursLine1 = "";

    @Column(nullable = false, length = 255)
    private String storeHoursLine2 = "";

    @Column(nullable = false, length = 100)
    private String authTitle = "";

    @Column(nullable = false, length = 255)
    private String authBadgeTitle = "";

    @Column(nullable = false, length = 255)
    private String authBadgeDetail = "";

    @Column(nullable = false, length = 100)
    private String navTitle = "";

    @Column(nullable = false, length = 100)
    private String backToTopText = "";

    @Column(nullable = false, length = 255)
    private String contactEmail = "";

    @Column(nullable = false, length = 100)
    private String contactPhone = "";

    @Column(nullable = false, length = 100)
    private String cnpjText = "";

    @Column(nullable = false, length = 100)
    private String instagramHandle = "";

    @Column(nullable = false, length = 255)
    private String citiesRail = "";

    @Column(nullable = false, length = 255)
    private String copyrightText = "Todos os direitos reservados.";

    @Version
    @Column(nullable = false)
    private Long version;
}
