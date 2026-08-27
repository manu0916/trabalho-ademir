package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {

    @Query("""
            select image.id as id, image.product.id as productId, image.sortOrder as sortOrder
            from ProductImage image
            where image.product.id in :productIds
            order by image.product.id desc, image.sortOrder asc, image.id asc
            """)
    List<ProductImageMetadata> findMetadataByProductIds(Collection<Long> productIds);

    Optional<ProductImage> findByIdAndProduct_Id(Long id, Long productId);

    void deleteByProduct_Id(Long productId);

    interface ProductImageMetadata {
        Long getId();

        Long getProductId();

        Integer getSortOrder();
    }
}
