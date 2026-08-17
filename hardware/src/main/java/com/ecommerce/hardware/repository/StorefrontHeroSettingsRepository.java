package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.StorefrontHeroSettings;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface StorefrontHeroSettingsRepository extends JpaRepository<StorefrontHeroSettings, Integer> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select settings from StorefrontHeroSettings settings where settings.id = :id")
    Optional<StorefrontHeroSettings> findByIdForUpdate(Integer id);
}
