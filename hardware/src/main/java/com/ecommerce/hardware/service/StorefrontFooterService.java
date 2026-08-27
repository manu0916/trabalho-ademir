package com.ecommerce.hardware.service;

import com.ecommerce.hardware.controller.StorefrontFooterResponse;
import com.ecommerce.hardware.controller.StorefrontFooterUpdateRequest;
import com.ecommerce.hardware.model.StorefrontFooterSettings;
import com.ecommerce.hardware.repository.StorefrontFooterSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StorefrontFooterService {

    private final StorefrontFooterSettingsRepository footerRepository;

    public StorefrontFooterService(StorefrontFooterSettingsRepository footerRepository) {
        this.footerRepository = footerRepository;
    }

    @Transactional(readOnly = true)
    public StorefrontFooterResponse getConfiguration() {
        StorefrontFooterSettings settings = footerRepository
                .findById(StorefrontFooterSettings.SINGLETON_ID)
                .orElseGet(StorefrontFooterSettings::new);
        return toResponse(settings);
    }

    @Transactional
    public StorefrontFooterResponse updateConfiguration(StorefrontFooterUpdateRequest request) {
        StorefrontFooterSettings settings = footerRepository
                .findByIdForUpdate(StorefrontFooterSettings.SINGLETON_ID)
                .orElseGet(() -> {
                    StorefrontFooterSettings initial = new StorefrontFooterSettings();
                    return footerRepository.saveAndFlush(initial);
                });

        if (request.wordmark() != null) {
            settings.setWordmark(request.wordmark().trim());
        }
        if (request.brandTagline() != null) {
            settings.setBrandTagline(request.brandTagline().trim());
        }
        if (request.locationTitle() != null) {
            settings.setLocationTitle(request.locationTitle().trim());
        }
        if (request.addressLine1() != null) {
            settings.setAddressLine1(request.addressLine1().trim());
        }
        if (request.addressLine2() != null) {
            settings.setAddressLine2(request.addressLine2().trim());
        }
        if (request.hoursTitle() != null) {
            settings.setHoursTitle(request.hoursTitle().trim());
        }
        if (request.storeHoursLine1() != null) {
            settings.setStoreHoursLine1(request.storeHoursLine1().trim());
        }
        if (request.storeHoursLine2() != null) {
            settings.setStoreHoursLine2(request.storeHoursLine2().trim());
        }
        if (request.authTitle() != null) {
            settings.setAuthTitle(request.authTitle().trim());
        }
        if (request.authBadgeTitle() != null) {
            settings.setAuthBadgeTitle(request.authBadgeTitle().trim());
        }
        if (request.authBadgeDetail() != null) {
            settings.setAuthBadgeDetail(request.authBadgeDetail().trim());
        }
        if (request.navTitle() != null) {
            settings.setNavTitle(request.navTitle().trim());
        }
        if (request.backToTopText() != null) {
            settings.setBackToTopText(request.backToTopText().trim());
        }
        if (request.contactEmail() != null) {
            settings.setContactEmail(request.contactEmail().trim());
        }
        if (request.contactPhone() != null) {
            settings.setContactPhone(request.contactPhone().trim());
        }
        if (request.cnpjText() != null) {
            settings.setCnpjText(request.cnpjText().trim());
        }
        if (request.instagramHandle() != null) {
            settings.setInstagramHandle(request.instagramHandle().trim());
        }
        if (request.citiesRail() != null) {
            settings.setCitiesRail(request.citiesRail().trim());
        }
        if (request.copyrightText() != null) {
            settings.setCopyrightText(request.copyrightText().trim());
        }

        StorefrontFooterSettings saved = footerRepository.save(settings);
        return toResponse(saved);
    }

    private StorefrontFooterResponse toResponse(StorefrontFooterSettings settings) {
        return new StorefrontFooterResponse(
                settings.getWordmark(),
                settings.getBrandTagline(),
                settings.getLocationTitle(),
                settings.getAddressLine1(),
                settings.getAddressLine2(),
                settings.getHoursTitle(),
                settings.getStoreHoursLine1(),
                settings.getStoreHoursLine2(),
                settings.getAuthTitle(),
                settings.getAuthBadgeTitle(),
                settings.getAuthBadgeDetail(),
                settings.getNavTitle(),
                settings.getBackToTopText(),
                settings.getContactEmail(),
                settings.getContactPhone(),
                settings.getCnpjText(),
                settings.getInstagramHandle(),
                settings.getCitiesRail(),
                settings.getCopyrightText()
        );
    }
}
