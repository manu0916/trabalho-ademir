package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.PaymentDispute;
import java.util.List;
import java.math.BigDecimal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentDisputeRepository extends JpaRepository<PaymentDispute, String> {
    @Query("select dispute.status from PaymentDispute dispute where dispute.orderId = :orderId")
    List<String> findStatuses(@Param("orderId") Long orderId);

    @Query("select coalesce(sum(dispute.amount), 0) from PaymentDispute dispute "
            + "where dispute.orderId = :orderId "
            + "and dispute.status not in ('won', 'warning_closed', 'prevented')")
    BigDecimal sumAmountAtRisk(@Param("orderId") Long orderId);
}
