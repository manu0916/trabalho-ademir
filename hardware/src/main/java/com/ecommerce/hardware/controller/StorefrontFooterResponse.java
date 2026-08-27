package com.ecommerce.hardware.controller;

public record StorefrontFooterResponse(
        String wordmark,
        String brandTagline,
        String locationTitle,
        String addressLine1,
        String addressLine2,
        String hoursTitle,
        String storeHoursLine1,
        String storeHoursLine2,
        String authTitle,
        String authBadgeTitle,
        String authBadgeDetail,
        String navTitle,
        String backToTopText,
        String contactEmail,
        String contactPhone,
        String cnpjText,
        String instagramHandle,
        String citiesRail,
        String copyrightText
) {
}
