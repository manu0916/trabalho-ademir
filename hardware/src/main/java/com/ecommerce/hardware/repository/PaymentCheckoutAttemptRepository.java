package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.PaymentCheckoutAttempt;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentCheckoutAttemptRepository extends JpaRepository<PaymentCheckoutAttempt, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select attempt from PaymentCheckoutAttempt attempt where attempt.idempotencyKey = :key")
    Optional<PaymentCheckoutAttempt> findByIdForUpdate(@Param("key") String key);

    @Query("select attempt.idempotencyKey from PaymentCheckoutAttempt attempt "
            + "where attempt.state = 'UNKNOWN' or (attempt.state = 'CREATING' "
            + "and (attempt.leaseExpiresAt is null or attempt.leaseExpiresAt < :now)) "
            + "order by attempt.updatedAt")
    List<String> findRecoverableKeys(@Param("now") Instant now, Pageable pageable);
}
