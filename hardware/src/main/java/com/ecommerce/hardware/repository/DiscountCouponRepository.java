package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.DiscountCoupon;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DiscountCouponRepository extends JpaRepository<DiscountCoupon, Long> {

    Optional<DiscountCoupon> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);

    List<DiscountCoupon> findAllByOrderByCreatedAtDesc();
}
