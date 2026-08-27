package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.StockAlert;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockAlertRepository extends JpaRepository<StockAlert, Long> {

    List<StockAlert> findAllByOrderByCreatedAtDesc();

    List<StockAlert> findByProductIdAndStatus(Long productId, String status);

    long countByStatus(String status);

    void deleteByProductId(Long productId);
}
