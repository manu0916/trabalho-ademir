package com.ecommerce.hardware.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "purchase_orders")
public class PurchaseOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private CustomerAccount customer;

    @Column(name = "full_name", nullable = false, length = 160)
    private String fullName;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(nullable = false, length = 11)
    private String cpf;

    @Column(name = "payment_method", nullable = false, length = 30)
    private String paymentMethod;

    @Column(name = "postal_code", length = 8)
    private String postalCode;

    @Column(length = 2)
    private String state;

    @Column(length = 120)
    private String city;

    @Column(length = 160)
    private String neighborhood;

    @Column(length = 180)
    private String street;

    @Column(name = "address_number", length = 20)
    private String addressNumber;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PaymentStatus status = PaymentStatus.PENDING_PAYMENT;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_state", nullable = false, length = 30)
    private PaymentState paymentState = PaymentState.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "refund_state", nullable = false, length = 20)
    private RefundState refundState = RefundState.NONE;

    @Enumerated(EnumType.STRING)
    @Column(name = "dispute_state", nullable = false, length = 20)
    private DisputeState disputeState = DisputeState.NONE;

    @Column(name = "fulfillment_review_required", nullable = false)
    private boolean fulfillmentReviewRequired;

    @Enumerated(EnumType.STRING)
    @Column(name = "inventory_status", nullable = false, length = 30)
    private InventoryStatus inventoryStatus = InventoryStatus.NONE;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_provider", nullable = false, length = 20)
    private PaymentProvider paymentProvider = PaymentProvider.STRIPE;

    @Column(name = "legacy_payment_reference", length = 600)
    private String legacyPaymentReference;

    /** Stable, non-sensitive identifier used for checkout and API idempotency. */
    @Column(name = "external_reference", unique = true, length = 80)
    private String externalReference;

    @Column(name = "checkout_session_id", unique = true, length = 255)
    private String checkoutSessionId;

    @Column(name = "checkout_status", length = 20)
    private String checkoutStatus;

    @Column(name = "checkout_url", length = 2048)
    private String checkoutUrl;

    @Column(name = "checkout_request_hash", length = 64)
    private String checkoutRequestHash;

    @Column(name = "checkout_expires_at")
    private Instant checkoutExpiresAt;

    @Column(name = "provider_success_url", length = 2048)
    private String providerSuccessUrl;

    @Column(name = "provider_cancel_url", length = 2048)
    private String providerCancelUrl;

    @Column(name = "pix_expires_seconds")
    private Long pixExpiresSeconds;

    @Column(name = "boleto_expires_days")
    private Long boletoExpiresDays;

    @Column(name = "payment_intent_id", unique = true, length = 255)
    private String paymentIntentId;

    @Column(name = "captured_amount", precision = 12, scale = 2)
    private BigDecimal capturedAmount;

    @Column(name = "captured_currency", length = 3)
    private String capturedCurrency;

    @Column(name = "refunded_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal refundedAmount = BigDecimal.ZERO;

    @Column(name = "refund_attempt_id", length = 36)
    private String refundAttemptId;

    @Column(name = "refund_attempt_amount", precision = 12, scale = 2)
    private BigDecimal refundAttemptAmount;

    @Column(name = "gateway_refund_id", length = 255)
    private String gatewayRefundId;

    @Column(name = "payment_failure_code", length = 80)
    private String paymentFailureCode;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "refunded_at")
    private Instant refundedAt;

    @Column(name = "payment_updated_at", nullable = false)
    private Instant paymentUpdatedAt = Instant.now();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "purchaseOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseOrderItem> items = new ArrayList<>();

    protected PurchaseOrder() {
    }

    public PurchaseOrder(CustomerAccount customer, String fullName, String email, String cpf,
                         String paymentMethod, BigDecimal total) {
        this(customer, fullName, email, cpf, paymentMethod, null, null, null, null, null, null, total);
    }

    public PurchaseOrder(CustomerAccount customer, String fullName, String email, String cpf, String paymentMethod,
                         String postalCode, String state, String city, String neighborhood, String street,
                         String addressNumber, BigDecimal total) {
        this.customer = customer;
        this.fullName = fullName;
        this.email = email;
        this.cpf = cpf;
        this.paymentMethod = paymentMethod;
        this.postalCode = postalCode;
        this.state = state;
        this.city = city;
        this.neighborhood = neighborhood;
        this.street = street;
        this.addressNumber = addressNumber;
        this.total = total;
    }

    public void addItem(PurchaseOrderItem item) {
        item.setPurchaseOrder(this);
        items.add(item);
    }

    public void attachCheckout(String checkoutSessionId, String checkoutUrl, String paymentIntentId) {
        this.checkoutSessionId = checkoutSessionId;
        this.checkoutUrl = checkoutUrl;
        this.checkoutStatus = "open";
        if (paymentIntentId != null && !paymentIntentId.isBlank()) this.paymentIntentId = paymentIntentId;
        touchPayment();
    }

    public boolean bindCheckoutIdentity(String checkoutSessionId, String paymentIntentId) {
        if (checkoutSessionId == null || checkoutSessionId.isBlank()) return false;
        if (this.checkoutSessionId != null && !this.checkoutSessionId.equals(checkoutSessionId)) return false;
        if (this.paymentIntentId != null && paymentIntentId != null
                && !this.paymentIntentId.equals(paymentIntentId)) return false;
        this.checkoutSessionId = checkoutSessionId;
        setPaymentIntentIfPresent(paymentIntentId);
        touchPayment();
        return true;
    }

    public void recordCheckoutStatus(String checkoutStatus) {
        if (checkoutStatus == null || checkoutStatus.isBlank()) return;
        this.checkoutStatus = checkoutStatus.toLowerCase();
        touchPayment();
    }

    public void configureHostedCheckout(Instant expiresAt, String successUrl, String cancelUrl,
                                        Long pixExpiresSeconds, Long boletoExpiresDays) {
        this.checkoutExpiresAt = expiresAt;
        this.providerSuccessUrl = successUrl;
        this.providerCancelUrl = cancelUrl;
        this.pixExpiresSeconds = pixExpiresSeconds;
        this.boletoExpiresDays = boletoExpiresDays;
    }

    public void reserveInventory() {
        this.inventoryStatus = InventoryStatus.RESERVED;
    }

    public void commitInventory() {
        this.inventoryStatus = InventoryStatus.COMMITTED;
    }

    public void releaseInventory() {
        this.inventoryStatus = InventoryStatus.RELEASED;
    }

    public void restoreInventory() {
        this.inventoryStatus = InventoryStatus.RESTORED;
    }

    public void markProcessing(String paymentIntentId) {
        if (paymentState != PaymentState.PENDING && paymentState != PaymentState.PROCESSING) return;
        this.paymentState = PaymentState.PROCESSING;
        setPaymentIntentIfPresent(paymentIntentId);
        this.paymentFailureCode = null;
        refreshStatus();
        touchPayment();
    }

    public void recordProcessingFailure(String paymentIntentId, String failureCode) {
        if (paymentState != PaymentState.PENDING && paymentState != PaymentState.PROCESSING) return;
        this.paymentState = PaymentState.PROCESSING;
        setPaymentIntentIfPresent(paymentIntentId);
        this.paymentFailureCode = sanitizeCode(failureCode);
        refreshStatus();
        touchPayment();
    }

    public void markPaid(String paymentIntentId, BigDecimal amount, String currency) {
        this.paymentState = PaymentState.SUCCEEDED;
        this.fulfillmentReviewRequired = false;
        setPaymentIntentIfPresent(paymentIntentId);
        recordCapture(amount, currency);
        this.paymentFailureCode = null;
        if (this.paidAt == null) this.paidAt = Instant.now();
        refreshStatus();
        touchPayment();
    }

    public void markPaymentReviewRequired(String paymentIntentId, String reasonCode,
                                          BigDecimal amount, String currency) {
        if (paymentState == PaymentState.SUCCEEDED) return;
        this.paymentState = PaymentState.REVIEW_REQUIRED;
        setPaymentIntentIfPresent(paymentIntentId);
        recordCapture(amount, currency);
        this.paymentFailureCode = sanitizeCode(reasonCode);
        refreshStatus();
        touchPayment();
    }

    public void markFulfillmentReviewRequired(String paymentIntentId, String reasonCode,
                                              BigDecimal amount, String currency) {
        this.paymentState = PaymentState.SUCCEEDED;
        this.fulfillmentReviewRequired = true;
        setPaymentIntentIfPresent(paymentIntentId);
        recordCapture(amount, currency);
        this.paymentFailureCode = sanitizeCode(reasonCode);
        if (this.paidAt == null) this.paidAt = Instant.now();
        refreshStatus();
        touchPayment();
    }

    public void markFailed(String failureCode) {
        if (paymentState != PaymentState.PENDING && paymentState != PaymentState.PROCESSING) return;
        this.paymentState = PaymentState.FAILED;
        this.paymentFailureCode = sanitizeCode(failureCode);
        refreshStatus();
        touchPayment();
    }

    public void markCanceled() {
        if (!canCancelPayment()) return;
        this.paymentState = PaymentState.CANCELED;
        refreshStatus();
        touchPayment();
    }

    public void markExpired() {
        if (!canCancelPayment()) return;
        this.paymentState = PaymentState.EXPIRED;
        refreshStatus();
        touchPayment();
    }

    public void prepareRefundAttempt(String attemptId, BigDecimal amount) {
        if (!canRequestRefund()) return;
        if (amount == null || amount.signum() <= 0 || total == null || amount.compareTo(total) > 0) {
            throw new IllegalArgumentException("Invalid refund attempt amount");
        }
        this.refundAttemptId = attemptId;
        this.refundAttemptAmount = amount;
        this.gatewayRefundId = null;
        this.refundState = RefundState.PENDING;
        this.paymentFailureCode = null;
        refreshStatus();
        touchPayment();
    }

    public void markExternalRefundPending() {
        if (refundState == RefundState.FULL) return;
        this.refundState = RefundState.PENDING;
        this.paymentFailureCode = null;
        refreshStatus();
        touchPayment();
    }

    public boolean hasActiveAmbiguousRefundAttempt() {
        return refundState == RefundState.PENDING
                && refundAttemptId != null && gatewayRefundId == null;
    }

    public void restoreAmbiguousRefundAttemptPending() {
        if (refundAttemptId == null || gatewayRefundId != null) return;
        this.refundState = RefundState.PENDING;
        this.paymentFailureCode = null;
        refreshStatus();
        touchPayment();
    }

    public void attachGatewayRefund(String attemptId, String refundId) {
        if (!matchesRefundAttempt(attemptId) || refundId == null || refundId.isBlank()) return;
        this.gatewayRefundId = refundId;
        touchPayment();
    }

    public boolean matchesRefundAttempt(String attemptId) {
        return attemptId != null && attemptId.equals(refundAttemptId);
    }

    public void applyRefundedAmount(BigDecimal amount) {
        BigDecimal normalized = amount == null ? BigDecimal.ZERO : amount.max(BigDecimal.ZERO).min(total);
        this.refundedAmount = normalized;
        this.refundedAt = normalized.signum() > 0 ? Instant.now() : null;
        this.refundState = normalized.compareTo(total) >= 0
                ? RefundState.FULL : normalized.signum() > 0 ? RefundState.PARTIAL : RefundState.NONE;
        refreshStatus();
        touchPayment();
    }

    public void markRefundFailed(String failureCode) {
        if (!isPaymentVerified()) return;
        if (refundState == RefundState.FULL || refundState == RefundState.PENDING) return;
        this.refundState = refundedAmount != null && refundedAmount.signum() > 0
                ? RefundState.PARTIAL : RefundState.FAILED;
        this.paymentFailureCode = sanitizeCode(failureCode);
        refreshStatus();
        touchPayment();
    }

    public void markDisputed() {
        this.disputeState = DisputeState.OPEN;
        refreshStatus();
        touchPayment();
    }

    public void closeDisputeWon() {
        this.disputeState = DisputeState.WON;
        refreshStatus();
        touchPayment();
    }

    public void closeDisputeLost() {
        this.disputeState = DisputeState.LOST;
        refreshStatus();
        touchPayment();
    }

    private void setPaymentIntentIfPresent(String value) {
        if (value != null && !value.isBlank() && this.paymentIntentId == null) this.paymentIntentId = value;
    }

    public void recordVerifiedCapture(BigDecimal amount, String currency) {
        recordCapture(amount, currency);
        if (this.paidAt == null) this.paidAt = Instant.now();
        touchPayment();
    }

    public boolean isPaymentVerified() {
        return paymentState == PaymentState.SUCCEEDED
                && capturedAmount != null
                && total != null
                && capturedAmount.compareTo(total) == 0
                && "brl".equalsIgnoreCase(capturedCurrency);
    }

    public boolean canCancelPayment() {
        return paymentState == PaymentState.PENDING || paymentState == PaymentState.PROCESSING;
    }

    public boolean isCheckoutCancelable() {
        return canCancelPayment() && (checkoutStatus == null || "open".equals(checkoutStatus));
    }

    public boolean canRequestRefund() {
        return isPaymentVerified() && refundState != RefundState.PENDING && refundState != RefundState.FULL
                && disputeState != DisputeState.OPEN && disputeState != DisputeState.LOST;
    }

    private void refreshStatus() {
        if (disputeState == DisputeState.OPEN) {
            status = PaymentStatus.DISPUTED;
        } else if (disputeState == DisputeState.LOST) {
            status = PaymentStatus.DISPUTE_LOST;
        } else if (refundState == RefundState.FULL) {
            status = PaymentStatus.REFUNDED;
        } else if (refundState == RefundState.PENDING) {
            status = PaymentStatus.REFUND_PENDING;
        } else if (refundState == RefundState.FAILED) {
            status = PaymentStatus.REFUND_FAILED;
        } else if (refundState == RefundState.PARTIAL) {
            status = PaymentStatus.PARTIALLY_REFUNDED;
        } else {
            status = switch (paymentState) {
                case PENDING -> PaymentStatus.PENDING_PAYMENT;
                case PROCESSING -> PaymentStatus.PAYMENT_PROCESSING;
                case SUCCEEDED -> fulfillmentReviewRequired
                        ? PaymentStatus.FULFILLMENT_REVIEW_REQUIRED : PaymentStatus.PAID;
                case FAILED -> PaymentStatus.PAYMENT_FAILED;
                case CANCELED -> PaymentStatus.PAYMENT_CANCELED;
                case EXPIRED -> PaymentStatus.PAYMENT_EXPIRED;
                case REVIEW_REQUIRED -> PaymentStatus.PAYMENT_REVIEW_REQUIRED;
            };
        }
    }

    private void recordCapture(BigDecimal amount, String currency) {
        if (amount != null) this.capturedAmount = amount;
        if (currency != null && !currency.isBlank()) this.capturedCurrency = currency.toLowerCase();
    }

    private void touchPayment() {
        this.paymentUpdatedAt = Instant.now();
    }

    private static String sanitizeCode(String value) {
        if (value == null || value.isBlank()) return null;
        String sanitized = value.replaceAll("[^A-Za-z0-9_.-]", "_");
        return sanitized.substring(0, Math.min(sanitized.length(), 80));
    }

    public Long getId() { return id; }
    public Long getCustomerId() { return customer == null ? null : customer.getId(); }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getCpf() { return cpf; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getPostalCode() { return postalCode; }
    public String getState() { return state; }
    public String getCity() { return city; }
    public String getNeighborhood() { return neighborhood; }
    public String getStreet() { return street; }
    public String getAddressNumber() { return addressNumber; }
    public BigDecimal getTotal() { return total; }
    public PaymentStatus getStatus() { return status; }
    public PaymentState getPaymentState() { return paymentState; }
    public RefundState getRefundState() { return refundState; }
    public DisputeState getDisputeState() { return disputeState; }
    public InventoryStatus getInventoryStatus() { return inventoryStatus; }
    public PaymentProvider getPaymentProvider() { return paymentProvider; }
    public String getLegacyPaymentReference() { return legacyPaymentReference; }
    public Instant getCreatedAt() { return createdAt; }
    public List<PurchaseOrderItem> getItems() { return items; }
    public String getExternalReference() { return externalReference; }
    public String getCheckoutSessionId() { return checkoutSessionId; }
    public String getCheckoutStatus() { return checkoutStatus; }
    public String getCheckoutUrl() { return checkoutUrl; }
    public String getCheckoutRequestHash() { return checkoutRequestHash; }
    public Instant getCheckoutExpiresAt() { return checkoutExpiresAt; }
    public String getProviderSuccessUrl() { return providerSuccessUrl; }
    public String getProviderCancelUrl() { return providerCancelUrl; }
    public Long getPixExpiresSeconds() { return pixExpiresSeconds; }
    public Long getBoletoExpiresDays() { return boletoExpiresDays; }
    public String getPaymentIntentId() { return paymentIntentId; }
    public BigDecimal getCapturedAmount() { return capturedAmount; }
    public String getCapturedCurrency() { return capturedCurrency; }
    public BigDecimal getRefundedAmount() { return refundedAmount; }
    public String getRefundAttemptId() { return refundAttemptId; }
    public BigDecimal getRefundAttemptAmount() { return refundAttemptAmount; }
    public String getGatewayRefundId() { return gatewayRefundId; }
    public boolean isDisputeOpen() { return disputeState == DisputeState.OPEN; }
    public String getPaymentFailureCode() { return paymentFailureCode; }
    public Instant getPaidAt() { return paidAt; }
    public Instant getRefundedAt() { return refundedAt; }
    public Instant getPaymentUpdatedAt() { return paymentUpdatedAt; }
    public void setExternalReference(String externalReference) { this.externalReference = externalReference; }
    public void setCheckoutRequestHash(String checkoutRequestHash) { this.checkoutRequestHash = checkoutRequestHash; }
    public void setTotal(BigDecimal total) { this.total = total; }
}
