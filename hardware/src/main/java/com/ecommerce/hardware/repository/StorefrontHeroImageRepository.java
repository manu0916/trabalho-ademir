package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.StorefrontHeroImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface StorefrontHeroImageRepository extends JpaRepository<StorefrontHeroImage, Long> {

    List<StorefrontHeroImage> findAllBySettingsIdOrderBySortOrderAscIdAsc(Integer settingsId);

    @Query("""
            select image.id as id, image.altText as altText, image.sortOrder as sortOrder
            from StorefrontHeroImage image
            where image.settingsId = :settingsId
            order by image.sortOrder asc, image.id asc
            """)
    List<HeroImageMetadata> findMetadataBySettingsId(Integer settingsId);

    long countBySettingsId(Integer settingsId);

    Optional<StorefrontHeroImage> findByIdAndSettingsId(Long id, Integer settingsId);

    interface HeroImageMetadata {
        Long getId();

        String getAltText();

        Integer getSortOrder();
    }
}
