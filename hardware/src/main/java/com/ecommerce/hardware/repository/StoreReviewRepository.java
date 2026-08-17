package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.StoreReview;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StoreReviewRepository extends JpaRepository<StoreReview, Long> {

    List<StoreReview> findAllByOrderByCreatedAtDesc(Pageable pageable);

    boolean existsByCustomerId(Long customerId);

    @Query("select avg(r.rating) from StoreReview r")
    Double calculateAverageRating();
}
