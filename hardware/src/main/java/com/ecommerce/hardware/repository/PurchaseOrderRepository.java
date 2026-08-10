package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.PurchaseOrder;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {
    List<PurchaseOrder> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
    List<PurchaseOrder> findByStatus(String status);
    List<PurchaseOrder> findAllByOrderByCreatedAtDesc();
    Optional<PurchaseOrder> findByExternalReference(String externalReference);
}
