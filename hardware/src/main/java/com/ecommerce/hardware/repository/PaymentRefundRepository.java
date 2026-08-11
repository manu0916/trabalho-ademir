package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.PaymentRefund;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRefundRepository extends JpaRepository<PaymentRefund, String> {
    @Query("select coalesce(sum(refund.amount), 0) from PaymentRefund refund "
            + "where refund.orderId = :orderId and refund.status = 'succeeded'")
    BigDecimal sumSucceededAmount(@Param("orderId") Long orderId);

    @Query("select case when count(refund) > 0 then true else false end from PaymentRefund refund "
            + "where refund.orderId = :orderId and refund.status in :statuses")
    boolean existsWithStatus(@Param("orderId") Long orderId, @Param("statuses") Collection<String> statuses);

    @Query("select refund.refundId from PaymentRefund refund where refund.status in :statuses order by refund.updatedAt")
    List<String> findIdsWithStatus(@Param("statuses") Collection<String> statuses, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select refund from PaymentRefund refund where refund.refundId = :refundId")
    Optional<PaymentRefund> findByIdForUpdate(@Param("refundId") String refundId);
}
