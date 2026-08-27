package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.ProductReview;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductReviewRepository extends JpaRepository<ProductReview, Long> {

    List<ProductReview> findByProductIdOrderByCreatedAtDesc(Long productId, Pageable pageable);

    boolean existsByCustomerIdAndProductId(Long customerId, Long productId);

    long countByProductId(Long productId);

    @Query("select avg(r.rating) from ProductReview r where r.product.id = :productId")
    Double calculateAverageRatingByProductId(@Param("productId") Long productId);

    void deleteByProductId(Long productId);
}
