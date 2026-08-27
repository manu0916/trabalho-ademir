package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.StorefrontFooterSettings;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface StorefrontFooterSettingsRepository extends JpaRepository<StorefrontFooterSettings, Integer> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select settings from StorefrontFooterSettings settings where settings.id = :id")
    Optional<StorefrontFooterSettings> findByIdForUpdate(Integer id);
}
