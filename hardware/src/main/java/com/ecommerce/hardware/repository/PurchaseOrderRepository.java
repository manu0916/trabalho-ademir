package com.ecommerce.hardware.repository;

import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.model.PaymentStatus;
import com.ecommerce.hardware.model.PaymentProvider;
import com.ecommerce.hardware.model.PaymentState;
import com.ecommerce.hardware.model.RefundState;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.time.Instant;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {
    @Query("select purchaseOrder from PurchaseOrder purchaseOrder "
            + "where purchaseOrder.customer.id = :customerId order by purchaseOrder.createdAt desc")
    List<PurchaseOrder> findByCustomerIdOrderByCreatedAtDesc(@Param("customerId") Long customerId);
    List<PurchaseOrder> findByStatus(PaymentStatus status);
    List<PurchaseOrder> findAllByOrderByCreatedAtDesc();
    Optional<PurchaseOrder> findByExternalReference(String externalReference);

    @Query("select purchaseOrder from PurchaseOrder purchaseOrder "
            + "where purchaseOrder.externalReference = :externalReference "
            + "and purchaseOrder.customer.id = :customerId")
    Optional<PurchaseOrder> findByExternalReferenceAndCustomerId(
            @Param("externalReference") String externalReference, @Param("customerId") Long customerId);

    @Query("select purchaseOrder from PurchaseOrder purchaseOrder "
            + "where purchaseOrder.checkoutSessionId = :checkoutSessionId "
            + "and purchaseOrder.customer.id = :customerId")
    Optional<PurchaseOrder> findByCheckoutSessionIdAndCustomerId(
            @Param("checkoutSessionId") String checkoutSessionId, @Param("customerId") Long customerId);

    @Query("select purchaseOrder from PurchaseOrder purchaseOrder "
            + "where purchaseOrder.id = :id and purchaseOrder.customer.id = :customerId")
    Optional<PurchaseOrder> findByIdAndCustomerId(@Param("id") Long id, @Param("customerId") Long customerId);

    Optional<PurchaseOrder> findByPaymentIntentId(String paymentIntentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "items")
    @Query("select purchaseOrder from PurchaseOrder purchaseOrder where purchaseOrder.checkoutSessionId = :sessionId")
    Optional<PurchaseOrder> findByCheckoutSessionIdForUpdate(@Param("sessionId") String sessionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "items")
    @Query("select purchaseOrder from PurchaseOrder purchaseOrder where purchaseOrder.externalReference = :externalReference")
    Optional<PurchaseOrder> findByExternalReferenceForUpdate(@Param("externalReference") String externalReference);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "items")
    @Query("select purchaseOrder from PurchaseOrder purchaseOrder where purchaseOrder.paymentIntentId = :paymentIntentId")
    Optional<PurchaseOrder> findByPaymentIntentIdForUpdate(@Param("paymentIntentId") String paymentIntentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = "items")
    @Query("select purchaseOrder from PurchaseOrder purchaseOrder where purchaseOrder.id = :id")
    Optional<PurchaseOrder> findByIdForUpdate(@Param("id") Long id);

    @Query("select purchaseOrder.id from PurchaseOrder purchaseOrder "
            + "where purchaseOrder.paymentProvider = :provider "
            + "and purchaseOrder.checkoutSessionId is not null "
            + "and purchaseOrder.paymentState in :states "
            + "and purchaseOrder.paymentUpdatedAt < :cutoff order by purchaseOrder.paymentUpdatedAt")
    List<Long> findStalePaymentIds(@Param("provider") PaymentProvider provider,
                                   @Param("states") List<PaymentState> states,
                                   @Param("cutoff") Instant cutoff, Pageable pageable);

    @Query("select purchaseOrder.id from PurchaseOrder purchaseOrder "
            + "where purchaseOrder.paymentProvider = :provider "
            + "and purchaseOrder.refundState = :refundState "
            + "and purchaseOrder.refundAttemptId is not null "
            + "and purchaseOrder.gatewayRefundId is null order by purchaseOrder.paymentUpdatedAt")
    List<Long> findAmbiguousRefundIds(@Param("provider") PaymentProvider provider,
                                      @Param("refundState") RefundState refundState, Pageable pageable);

    @Query("select purchaseOrder.id from PurchaseOrder purchaseOrder "
            + "where purchaseOrder.paymentProvider = :provider "
            + "and purchaseOrder.refundState = :refundState "
            + "and purchaseOrder.paymentIntentId is not null order by purchaseOrder.paymentUpdatedAt")
    List<Long> findRefundReconciliationIds(@Param("provider") PaymentProvider provider,
                                           @Param("refundState") RefundState refundState, Pageable pageable);
}
