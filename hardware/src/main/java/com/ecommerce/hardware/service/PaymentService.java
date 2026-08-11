package com.ecommerce.hardware.service;

import com.ecommerce.hardware.model.CustomerAccount;
import com.ecommerce.hardware.model.InventoryStatus;
import com.ecommerce.hardware.model.PaymentCheckoutAttempt;
import com.ecommerce.hardware.model.PaymentDispute;
import com.ecommerce.hardware.model.PaymentProvider;
import com.ecommerce.hardware.model.PaymentRefund;
import com.ecommerce.hardware.model.DisputeState;
import com.ecommerce.hardware.model.RefundState;
import com.ecommerce.hardware.model.PaymentStatus;
import com.ecommerce.hardware.model.PaymentWebhookEvent;
import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.model.PurchaseOrderItem;
import com.ecommerce.hardware.repository.PaymentCheckoutAttemptRepository;
import com.ecommerce.hardware.repository.PaymentDisputeRepository;
import com.ecommerce.hardware.repository.PaymentRefundRepository;
import com.ecommerce.hardware.repository.PaymentWebhookEventRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import com.ecommerce.hardware.service.StripePaymentGateway.VerifiedWebhookEvent;
import com.ecommerce.hardware.service.StripePaymentGateway.GatewayOperationException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PaymentService {
    private static final Logger LOG = LoggerFactory.getLogger(PaymentService.class);
    private static final long MAX_STRIPE_AMOUNT = 99_999_999L;
    private static final String CURRENCY = "brl";
    private static final String INTEGRATION_MARKER = "nexus_checkout_v1";

    private final ProductRepository products;
    private final PurchaseOrderRepository orders;
    private final PaymentCheckoutAttemptRepository checkoutAttempts;
    private final PaymentDisputeRepository disputes;
    private final PaymentRefundRepository refunds;
    private final PaymentWebhookEventRepository webhookEvents;
    private final StripePaymentGateway stripe;
    private final TransactionTemplate transactions;

    public PaymentService(ProductRepository products, PurchaseOrderRepository orders,
                          PaymentCheckoutAttemptRepository checkoutAttempts,
                          PaymentRefundRepository refunds, PaymentDisputeRepository disputes,
                          PaymentWebhookEventRepository webhookEvents,
                          StripePaymentGateway stripe,
                          PlatformTransactionManager transactionManager) {
        this.products = products;
        this.orders = orders;
        this.checkoutAttempts = checkoutAttempts;
        this.refunds = refunds;
        this.disputes = disputes;
        this.webhookEvents = webhookEvents;
        this.stripe = stripe;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    /**
     * Database locks are held only while reserving and attaching. The provider call is deliberately
     * outside a transaction so a slow network cannot exhaust the small production connection pool.
     */
    public CheckoutResult startCheckout(CustomerAccount customer, CheckoutCustomer checkoutCustomer,
                                        List<RequestedItem> requestedItems, String idempotencyKey) {
        Map<Long, Integer> quantities = aggregate(requestedItems);
        String requestHash = checkoutRequestHash(checkoutCustomer, quantities);
        ensureCheckoutAttempt(idempotencyKey, customer.getId(), requestHash);

        CheckoutPreparation preparation = required(transactions.execute(ignored -> prepareCheckout(
                customer, checkoutCustomer, quantities, idempotencyKey, requestHash)));
        if (preparation.replay() != null) return preparation.replay();
        if (preparation.inProgress()) {
            throw new CheckoutConflictException("CHECKOUT_ATTEMPT_IN_PROGRESS",
                    "Este checkout já está sendo criado. Tente novamente em alguns instantes.");
        }

        StripePaymentGateway.CheckoutSession checkout;
        try {
            checkout = stripe.createCheckout(preparation.order(), preparation.items(),
                    "checkout-" + idempotencyKey);
        } catch (GatewayOperationException exception) {
            if (exception.isIndeterminate() || preparation.recovery()) {
                transactions.executeWithoutResult(ignored -> markCheckoutCreationUnknown(
                        idempotencyKey, preparation.leaseToken()));
            } else {
                transactions.executeWithoutResult(ignored -> compensateCheckoutCreationFailure(
                        preparation.order().getId(), idempotencyKey, preparation.leaseToken()));
            }
            throw exception;
        } catch (RuntimeException exception) {
            if (preparation.recovery()) {
                transactions.executeWithoutResult(ignored -> markCheckoutCreationUnknown(
                        idempotencyKey, preparation.leaseToken()));
            } else {
                transactions.executeWithoutResult(ignored -> compensateCheckoutCreationFailure(
                        preparation.order().getId(), idempotencyKey, preparation.leaseToken()));
            }
            throw exception;
        }

        try {
            return required(transactions.execute(ignored -> attachCheckout(
                    preparation.order().getId(), idempotencyKey, preparation.leaseToken(), checkout)));
        } catch (RuntimeException exception) {
            transactions.executeWithoutResult(ignored -> markCheckoutCreationUnknown(
                    idempotencyKey, preparation.leaseToken()));
            throw exception;
        }
    }

    /** Repairs ambiguous provider calls and missed webhooks without holding database locks on I/O. */
    @Scheduled(fixedDelayString = "${app.stripe.reconciliation-interval-ms:60000}",
            initialDelayString = "${app.stripe.reconciliation-interval-ms:60000}")
    public void reconcileDuePayments() {
        for (String key : checkoutAttempts.findRecoverableKeys(Instant.now(), PageRequest.of(0, 20))) {
            try {
                recoverCheckoutAttempt(key);
            } catch (RuntimeException exception) {
                LOG.warn("Stripe checkout reconciliation deferred: attemptKeyHash={}", shortHash(key));
            }
        }

        Instant cutoff = Instant.now().minus(5, ChronoUnit.MINUTES);
        List<Long> orderIds = orders.findStalePaymentIds(PaymentProvider.STRIPE,
                List.of(com.ecommerce.hardware.model.PaymentState.PENDING,
                        com.ecommerce.hardware.model.PaymentState.PROCESSING),
                cutoff, PageRequest.of(0, 20));
        for (Long orderId : orderIds) {
            try {
                reconcileProviderOrder(orderId);
            } catch (RuntimeException exception) {
                LOG.warn("Stripe order reconciliation deferred: orderId={}", orderId);
            }
        }
        for (Long orderId : orders.findRefundReconciliationIds(PaymentProvider.STRIPE, RefundState.PENDING,
                PageRequest.of(0, 20))) {
            try {
                reconcileProviderRefunds(orderId);
            } catch (RuntimeException exception) {
                LOG.warn("Stripe refund reconciliation deferred: orderId={}", orderId);
            }
        }
        for (Long orderId : orders.findAmbiguousRefundIds(PaymentProvider.STRIPE, RefundState.PENDING,
                PageRequest.of(0, 20))) {
            try {
                recoverAmbiguousRefund(orderId);
            } catch (RuntimeException exception) {
                LOG.warn("Stripe refund creation reconciliation deferred: orderId={}", orderId);
            }
        }
    }

    private void recoverAmbiguousRefund(Long orderId) {
        RefundRecoveryTarget target = transactions.execute(ignored -> orders.findById(orderId)
                .filter(order -> order.getPaymentProvider() == PaymentProvider.STRIPE)
                .filter(order -> order.getRefundState() == RefundState.PENDING)
                .filter(order -> order.getRefundAttemptId() != null && order.getGatewayRefundId() == null)
                .filter(order -> order.getPaymentIntentId() != null)
                .map(order -> new RefundRecoveryTarget(order.getId(), order.getPaymentIntentId(),
                        order.getExternalReference(), order.getRefundAttemptId(),
                        StripePaymentGateway.toMinorUnits(refundAttemptAmount(order))))
                .orElse(null));
        if (target == null || target.amountMinor() <= 0) return;

        StripePaymentGateway.RefundResult result;
        try {
            result = stripe.refund(target.paymentIntentId(), target.amountMinor(),
                    target.externalReference(), target.attemptId(), "refund-" + target.attemptId());
        } catch (GatewayOperationException exception) {
            if (!exception.isIndeterminate()) {
                transactions.executeWithoutResult(ignored -> markRefundRequestFailed(
                        target.orderId(), target.attemptId(), "provider_refund_rejected"));
            }
            throw exception;
        }
        transactions.execute(ignored -> attachRefund(target.orderId(),
                new RefundPreparation(target.paymentIntentId(), target.externalReference(),
                        target.attemptId(), target.amountMinor()), result));
    }

    private void reconcileProviderRefunds(Long orderId) {
        RefundReconciliationTarget target = transactions.execute(ignored -> orders.findById(orderId)
                .filter(order -> order.getPaymentProvider() == PaymentProvider.STRIPE)
                .filter(order -> order.getRefundState() == RefundState.PENDING)
                .filter(order -> order.getPaymentIntentId() != null)
                .map(order -> new RefundReconciliationTarget(order.getId(), order.getPaymentIntentId(),
                        order.getExternalReference()))
                .orElse(null));
        if (target == null) return;
        List<StripePaymentGateway.RefundResult> snapshots = stripe.listRefunds(target.paymentIntentId());
        transactions.executeWithoutResult(ignored -> applyRefundSnapshots(target, snapshots));
    }

    private void applyRefundSnapshots(RefundReconciliationTarget target,
                                      List<StripePaymentGateway.RefundResult> snapshots) {
        PurchaseOrder order = orders.findByIdForUpdate(target.orderId()).orElse(null);
        if (order == null || order.getPaymentProvider() != PaymentProvider.STRIPE
                || !Objects.equals(target.paymentIntentId(), order.getPaymentIntentId())
                || !Objects.equals(target.externalReference(), order.getExternalReference())) return;

        int validSnapshots = 0;
        for (StripePaymentGateway.RefundResult snapshot
                : snapshots == null ? List.<StripePaymentGateway.RefundResult>of() : snapshots) {
            if (!validRefundSnapshot(order, snapshot)) continue;
            String attemptId = normalizedRefundAttemptId(snapshot.metadataRefundAttemptId());
            String status = snapshot.status().toLowerCase(Locale.ROOT);
            PaymentRefund refund = refunds.findByIdForUpdate(snapshot.id()).orElse(null);
            if (refund == null) {
                refunds.save(new PaymentRefund(snapshot.id(), order.getId(), attemptId, amount(snapshot.amount()),
                        snapshot.currency().toLowerCase(Locale.ROOT), status,
                        snapshot.created() == null ? 0L : snapshot.created(), 0));
            } else if (!Objects.equals(order.getId(), refund.getOrderId())) {
                LOG.error("Stripe refund belongs to a different order: orderId={} refundId={}",
                        order.getId(), safeId(snapshot.id()));
                continue;
            } else {
                refund.reconcile(amount(snapshot.amount()), snapshot.currency().toLowerCase(Locale.ROOT), status);
            }
            validSnapshots++;
            if (attemptId != null && order.matchesRefundAttempt(attemptId)) {
                order.attachGatewayRefund(attemptId, snapshot.id());
            }
        }
        if (validSnapshots == 0) return;
        deriveSucceededRefundTotal(order, "refund_reconciliation");
    }

    private boolean validRefundSnapshot(PurchaseOrder order, StripePaymentGateway.RefundResult snapshot) {
        boolean validIdentity = snapshot != null
                && Objects.equals(order.getPaymentIntentId(), snapshot.paymentIntentId())
                && (snapshot.integration() == null || INTEGRATION_MARKER.equals(snapshot.integration()))
                && (snapshot.metadataOrderReference() == null
                || Objects.equals(order.getExternalReference(), snapshot.metadataOrderReference()));
        boolean validFinancialObject = validIdentity
                && snapshot.id() != null && snapshot.id().matches("re_[A-Za-z0-9_]{8,250}")
                && snapshot.amount() != null && snapshot.amount() > 0
                && snapshot.amount() <= StripePaymentGateway.toMinorUnits(order.getTotal())
                && CURRENCY.equalsIgnoreCase(snapshot.currency())
                && snapshot.status() != null && !snapshot.status().isBlank()
                && snapshot.status().length() <= 30;
        if (!validFinancialObject) {
            LOG.error("Stripe refund snapshot requires review: orderId={} refundId={}",
                    order.getId(), safeId(snapshot == null ? null : snapshot.id()));
        }
        return validFinancialObject;
    }

    private void recoverCheckoutAttempt(String key) {
        CheckoutPreparation preparation = transactions.execute(ignored -> prepareCheckoutRecovery(key));
        if (preparation == null || preparation.replay() != null || preparation.inProgress()) return;

        try {
            StripePaymentGateway.CheckoutSession checkout = stripe.createCheckout(
                    preparation.order(), preparation.items(), "checkout-" + key);
            transactions.execute(ignored -> attachCheckout(preparation.order().getId(), key,
                    preparation.leaseToken(), checkout));
        } catch (RuntimeException exception) {
            boolean definitive = exception instanceof GatewayOperationException gateway
                    && !gateway.isIndeterminate();
            transactions.executeWithoutResult(ignored -> deferOrExpireCheckoutRecovery(
                    preparation.order().getId(), key, preparation.leaseToken(), definitive));
        }
    }

    private CheckoutPreparation prepareCheckoutRecovery(String key) {
        PaymentCheckoutAttempt attempt = checkoutAttempts.findByIdForUpdate(key).orElse(null);
        if (attempt == null || "READY".equals(attempt.getState()) || "FAILED".equals(attempt.getState())) return null;
        PurchaseOrder order = attempt.getOrderId() == null ? null
                : orders.findByIdForUpdate(attempt.getOrderId()).orElse(null);
        if (order == null) {
            attempt.markFailed();
            return null;
        }
        if (order.getCheckoutSessionId() != null) {
            attempt.markReady();
            return null;
        }
        if (attempt.creationInProgress(Instant.now())) return null;
        if (checkoutCreationDeadline(order).isBefore(Instant.now())) {
            if (order.canCancelPayment()) {
                releaseReservedInventory(order);
                order.markExpired();
            }
            attempt.markFailed();
            return null;
        }
        return existingCheckoutPreparation(order, attempt.getCustomerId(), attempt.getRequestHash(), attempt);
    }

    private void deferOrExpireCheckoutRecovery(Long orderId, String key, String leaseToken, boolean definitive) {
        PaymentCheckoutAttempt attempt = checkoutAttempts.findByIdForUpdate(key).orElse(null);
        PurchaseOrder order = orders.findByIdForUpdate(orderId).orElse(null);
        if (attempt == null || order == null || !attempt.ownsLease(leaseToken)) return;
        if (!definitive && checkoutCreationDeadline(order).isAfter(Instant.now())) {
            attempt.markUnknown();
            return;
        }
        if (order.canCancelPayment()) {
            releaseReservedInventory(order);
            order.markExpired();
        }
        attempt.markFailed();
    }

    private void reconcileProviderOrder(Long orderId) {
        ReconciliationTarget target = transactions.execute(ignored -> orders.findById(orderId)
                .filter(order -> order.getPaymentProvider() == PaymentProvider.STRIPE)
                .filter(order -> order.getCheckoutSessionId() != null)
                .map(order -> new ReconciliationTarget(order.getId(), order.getCheckoutSessionId(),
                        order.getPaymentIntentId()))
                .orElse(null));
        if (target == null) return;

        StripePaymentGateway.CheckoutSnapshot checkout = stripe.retrieveCheckout(target.checkoutSessionId());
        transactions.executeWithoutResult(ignored -> applyCheckoutSnapshot(target.orderId(), checkout));
        String paymentIntentId = checkout.paymentIntentId() == null
                ? target.paymentIntentId() : checkout.paymentIntentId();
        if (paymentIntentId != null && !"paid".equals(checkout.paymentStatus())) {
            StripePaymentGateway.PaymentIntentSnapshot intent = stripe.retrievePaymentIntent(paymentIntentId);
            transactions.executeWithoutResult(ignored -> applyPaymentIntentSnapshot(target.orderId(), intent));
        }
    }

    private void applyCheckoutSnapshot(Long orderId, StripePaymentGateway.CheckoutSnapshot snapshot) {
        PurchaseOrder order = orders.findByIdForUpdate(orderId).orElse(null);
        if (order == null || !Objects.equals(order.getCheckoutSessionId(), snapshot.id())) return;
        if (!INTEGRATION_MARKER.equals(snapshot.integration())
                || !Objects.equals(order.getExternalReference(), snapshot.externalReference())
                || !Objects.equals(order.getExternalReference(), snapshot.metadataOrderReference())
                || !CURRENCY.equalsIgnoreCase(snapshot.currency())
                || !expectedAmount(order, snapshot.amountTotal())
                || !order.bindCheckoutIdentity(snapshot.id(), snapshot.paymentIntentId())) {
            order.markPaymentReviewRequired(snapshot.paymentIntentId(), "reconciliation_verification_failed",
                    amount(snapshot.amountTotal()), snapshot.currency());
            return;
        }
        order.recordCheckoutStatus(snapshot.status());
        if ("paid".equals(snapshot.paymentStatus()) || "no_payment_required".equals(snapshot.paymentStatus())) {
            fulfill(order, snapshot.paymentIntentId(), amount(snapshot.amountTotal()), snapshot.currency(),
                    "reconciliation_checkout");
        } else if ("expired".equals(snapshot.status())) {
            if (order.canCancelPayment()) releaseReservedInventory(order);
            order.markExpired();
        } else if ("complete".equals(snapshot.status())) {
            order.markProcessing(snapshot.paymentIntentId());
        }
    }

    private void applyPaymentIntentSnapshot(Long orderId, StripePaymentGateway.PaymentIntentSnapshot snapshot) {
        PurchaseOrder order = orders.findByIdForUpdate(orderId).orElse(null);
        if (order == null) return;
        if (!INTEGRATION_MARKER.equals(snapshot.integration())
                || !Objects.equals(order.getExternalReference(), snapshot.metadataOrderReference())
                || !compatiblePaymentIntent(order, snapshot.id())
                || !CURRENCY.equalsIgnoreCase(snapshot.currency()) || !expectedAmount(order, snapshot.amount())) {
            order.markPaymentReviewRequired(snapshot.id(), "intent_reconciliation_verification_failed",
                    amount(snapshot.amount()), snapshot.currency());
            return;
        }
        switch (snapshot.status()) {
            case "succeeded" -> fulfill(order, snapshot.id(), amount(snapshot.amount()), snapshot.currency(),
                    "reconciliation_intent");
            case "canceled" -> {
                if (order.canCancelPayment()) releaseReservedInventory(order);
                order.markFailed("payment_intent_canceled");
            }
            case "processing", "requires_action" -> order.markProcessing(snapshot.id());
            case "requires_payment_method" -> {
                if ("complete".equals(order.getCheckoutStatus())
                        && !"CARTAO_CREDITO".equals(order.getPaymentMethod())) {
                    if (order.canCancelPayment()) releaseReservedInventory(order);
                    order.markFailed("async_payment_requires_new_method");
                } else {
                    order.recordProcessingFailure(snapshot.id(), "requires_payment_method");
                }
            }
            default -> { }
        }
    }

    private static Instant checkoutCreationDeadline(PurchaseOrder order) {
        Instant base = order.getCheckoutExpiresAt() == null ? order.getCreatedAt().plus(32, ChronoUnit.MINUTES)
                : order.getCheckoutExpiresAt();
        return base.plus(10, ChronoUnit.MINUTES);
    }

    private static String paymentStatusUrl(PurchaseOrder order) {
        String successUrl = order.getProviderSuccessUrl();
        if (successUrl == null || successUrl.isBlank()) return order.getCheckoutUrl();
        if (successUrl.contains("{CHECKOUT_SESSION_ID}")) {
            return successUrl.replace("{CHECKOUT_SESSION_ID}", order.getCheckoutSessionId());
        }
        return successUrl + (successUrl.contains("?") ? "&" : "?")
                + "session_id=" + order.getCheckoutSessionId();
    }

    @Transactional(readOnly = true)
    public PaymentView statusBySession(String checkoutSessionId, Long customerId) {
        validateStripeId(checkoutSessionId, "cs_");
        PurchaseOrder order = orders.findByCheckoutSessionIdAndCustomerId(checkoutSessionId, customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido não encontrado."));
        return PaymentView.from(order);
    }

    @Transactional(readOnly = true)
    public PaymentView statusByOrder(Long orderId, Long customerId) {
        PurchaseOrder order = orders.findByIdAndCustomerId(orderId, customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido não encontrado."));
        return PaymentView.from(order);
    }

    public PaymentView cancel(Long orderId, Long customerId) {
        CancelPreparation preparation = required(transactions.execute(ignored -> prepareCancel(orderId, customerId)));
        if (!preparation.callProvider()) return preparation.current();

        try {
            stripe.expireCheckout(preparation.checkoutSessionId(),
                    "expire-" + preparation.externalReference());
        } catch (RuntimeException exception) {
            PaymentView current = transactions.execute(ignored -> currentPayment(orderId, customerId));
            if (current != null && (PaymentStatus.PAYMENT_CANCELED.name().equals(current.status())
                    || PaymentStatus.PAYMENT_EXPIRED.name().equals(current.status()))) return current;
            throw exception;
        }

        return required(transactions.execute(ignored -> finalizeCancel(orderId, customerId)));
    }

    public PaymentView refund(Long orderId) {
        RefundPreparation preparation = required(transactions.execute(ignored -> prepareRefund(orderId)));
        StripePaymentGateway.RefundResult result;
        try {
            result = stripe.refund(preparation.paymentIntentId(), preparation.amountMinor(),
                    preparation.externalReference(), preparation.attemptId(), "refund-" + preparation.attemptId());
        } catch (GatewayOperationException exception) {
            if (!exception.isIndeterminate()) {
                transactions.executeWithoutResult(ignored -> markRefundRequestFailed(
                        orderId, preparation.attemptId(), "provider_refund_rejected"));
            }
            throw exception;
        }
        return required(transactions.execute(ignored -> attachRefund(orderId, preparation, result)));
    }

    private void markRefundRequestFailed(Long orderId, String attemptId, String failureCode) {
        PurchaseOrder order = orders.findByIdForUpdate(orderId).orElse(null);
        if (order != null && order.matchesRefundAttempt(attemptId)) {
            order.applyRefundedAmount(order.getRefundedAmount());
            order.markRefundFailed(failureCode);
        }
    }

    public void processWebhook(VerifiedWebhookEvent event) {
        validateWebhookEnvelope(event);
        try {
            transactions.executeWithoutResult(ignored -> processWebhookTransaction(event));
        } catch (UnresolvedStripeIntentEvent unresolved) {
            StripePaymentGateway.PaymentIntentSnapshot intent = stripe.retrievePaymentIntent(event.paymentIntentId());
            if (!INTEGRATION_MARKER.equals(intent.integration()) || intent.metadataOrderReference() == null) {
                transactions.executeWithoutResult(ignored -> acknowledgeUnrelatedEvent(event));
                return;
            }
            VerifiedWebhookEvent enriched = new VerifiedWebhookEvent(event.id(), event.type(), event.created(),
                    event.objectId(), event.checkoutSessionId(), event.externalReference(), intent.id(),
                    event.paymentStatus(), event.objectStatus(), event.currency(), event.amountTotal(),
                    event.amountRefunded(), event.failureCode(), intent.metadataOrderReference(),
                    event.metadataRefundAttemptId(), intent.integration());
            transactions.executeWithoutResult(ignored -> processWebhookTransaction(enriched));
        }
    }

    private void processWebhookTransaction(VerifiedWebhookEvent event) {
        if (webhookEvents.existsById(event.id())) return;

        try {
            switch (event.type()) {
                case "checkout.session.completed" -> processCheckoutCompleted(event);
                case "checkout.session.async_payment_succeeded" -> fulfillCheckout(event);
                case "checkout.session.async_payment_failed" -> failPayment(event, "async_payment_failed");
                case "checkout.session.expired" -> expirePayment(event);
                case "payment_intent.processing", "payment_intent.requires_action" -> processPaymentIntent(event);
                case "payment_intent.succeeded" -> fulfillPaymentIntent(event);
                case "payment_intent.payment_failed" -> recordIntentFailure(event);
                case "payment_intent.canceled" -> cancelPaymentIntent(event);
                case "refund.created", "refund.updated", "charge.refund.updated" -> processRefundState(event);
                case "refund.failed" -> failRefund(event);
                case "charge.refunded" -> applyRefund(event);
                case "charge.dispute.created", "charge.dispute.updated",
                        "charge.dispute.funds_withdrawn", "charge.dispute.funds_reinstated" -> markDisputed(event);
                case "charge.dispute.closed" -> closeDispute(event);
                default -> LOG.debug("Ignoring unsupported Stripe event: eventId={} type={}",
                        safeId(event.id()), safeType(event.type()));
            }
        } catch (AlreadyProcessedWebhook ignored) {
            return;
        } catch (UnrelatedStripeEvent ignored) {
            LOG.debug("Ignoring unrelated Stripe event: eventId={} type={}",
                    safeId(event.id()), safeType(event.type()));
        }

        webhookEvents.saveAndFlush(new PaymentWebhookEvent(event.id(), event.type(), event.objectId()));
    }

    private void acknowledgeUnrelatedEvent(VerifiedWebhookEvent event) {
        if (!webhookEvents.existsById(event.id())) {
            webhookEvents.saveAndFlush(new PaymentWebhookEvent(event.id(), event.type(), event.objectId()));
        }
    }

    private void ensureCheckoutAttempt(String key, Long customerId, String requestHash) {
        try {
            transactions.executeWithoutResult(ignored -> {
                if (!checkoutAttempts.existsById(key)) {
                    checkoutAttempts.saveAndFlush(new PaymentCheckoutAttempt(key, customerId, requestHash));
                }
            });
        } catch (DataIntegrityViolationException concurrentInsert) {
            Boolean exists = transactions.execute(ignored -> checkoutAttempts.existsById(key));
            if (!Boolean.TRUE.equals(exists)) throw concurrentInsert;
        }
    }

    private CheckoutPreparation prepareCheckout(CustomerAccount customer, CheckoutCustomer details,
                                                Map<Long, Integer> quantities, String key, String requestHash) {
        PaymentCheckoutAttempt attempt = checkoutAttempts.findByIdForUpdate(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "A tentativa de pagamento não pôde ser recuperada."));
        if (!Objects.equals(customer.getId(), attempt.getCustomerId())
                || !constantTimeEquals(requestHash, attempt.getRequestHash())) {
            throw new CheckoutConflictException("IDEMPOTENCY_PAYLOAD_MISMATCH",
                    "A chave de idempotência já foi usada com outro checkout.");
        }

        PurchaseOrder existing = attempt.getOrderId() == null ? null
                : orders.findByIdForUpdate(attempt.getOrderId()).orElse(null);
        if (existing == null) {
            existing = orders.findByExternalReferenceForUpdate(key).orElse(null);
            if (existing != null) attempt.attachOrder(existing.getId());
        }
        if (existing != null) return existingCheckoutPreparation(existing, customer.getId(), requestHash, attempt);

        PurchaseOrder order = new PurchaseOrder(customer, details.fullName(), details.email(), details.cpf(),
                details.paymentMethod(), details.postalCode(), details.state(), details.city(), details.neighborhood(),
                details.street(), details.addressNumber(), BigDecimal.ZERO);
        order.setExternalReference(key);
        order.setCheckoutRequestHash(requestHash);

        BigDecimal total = BigDecimal.ZERO;
        List<StripePaymentGateway.CheckoutItem> gatewayItems = new ArrayList<>();
        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            Product product = products.findByIdForUpdate(entry.getKey())
                    .orElseThrow(() -> badRequest("Produto não encontrado."));
            int quantity = entry.getValue();
            if (quantity > 99) throw badRequest("A quantidade máxima por produto é 99.");
            if (product.getStockQuantity() < quantity) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Estoque insuficiente para " + product.getName() + ".");
            }
            product.setStockQuantity(product.getStockQuantity() - quantity);
            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(quantity)));
            String productName = product.getName().substring(0, Math.min(product.getName().length(), 180));
            order.addItem(new PurchaseOrderItem(product.getId(), productName, quantity, product.getPrice()));
            gatewayItems.add(new StripePaymentGateway.CheckoutItem(product.getId(), productName, quantity,
                    product.getPrice(), null));
        }

        validateProviderAmount(details.paymentMethod(), total);
        order.setTotal(total);
        order.reserveInventory();
        PurchaseOrder persisted = orders.saveAndFlush(order);
        StripePaymentGateway.CheckoutConfiguration configuration = stripe.checkoutConfiguration(persisted.getId());
        persisted.configureHostedCheckout(configuration.expiresAt(), configuration.successUrl(),
                configuration.cancelUrl(), configuration.pixExpiresSeconds(), configuration.boletoExpiresDays());
        attempt.attachOrder(persisted.getId());
        String leaseToken = UUID.randomUUID().toString();
        attempt.beginCreation(leaseToken, Instant.now().plusSeconds(300));
        return new CheckoutPreparation(persisted, gatewayItems, null, leaseToken, false, false);
    }

    private CheckoutPreparation existingCheckoutPreparation(PurchaseOrder order, Long customerId, String requestHash,
                                                             PaymentCheckoutAttempt attempt) {
        if (!Objects.equals(customerId, order.getCustomerId())
                || !constantTimeEquals(requestHash, order.getCheckoutRequestHash())) {
            throw new CheckoutConflictException("IDEMPOTENCY_PAYLOAD_MISMATCH",
                    "A chave de idempotência já foi usada com outro checkout.");
        }
        if (order.getCheckoutSessionId() != null && order.getCheckoutUrl() != null) {
            attempt.markReady();
            if (order.isPaymentVerified() || "complete".equals(order.getCheckoutStatus())) {
                return new CheckoutPreparation(order, List.of(),
                        new CheckoutResult(order.getId(), paymentStatusUrl(order)), null, false, false);
            }
            if (order.isCheckoutCancelable() && checkoutCreationDeadline(order).isAfter(Instant.now())) {
                return new CheckoutPreparation(order, List.of(),
                        new CheckoutResult(order.getId(), order.getCheckoutUrl()), null, false, false);
            }
            throw new CheckoutConflictException("CHECKOUT_ATTEMPT_TERMINAL",
                    "Esta tentativa de checkout já foi encerrada. Inicie uma nova tentativa.");
        }
        if (attempt.creationInProgress(Instant.now())) {
            return new CheckoutPreparation(order, List.of(), null, null, true, false);
        }
        if (!order.canCancelPayment() || order.getInventoryStatus() != InventoryStatus.RESERVED
                || order.getCheckoutSessionId() != null) {
            throw new CheckoutConflictException("CHECKOUT_ATTEMPT_TERMINAL",
                    "Esta tentativa de checkout já foi encerrada. Inicie uma nova tentativa.");
        }

        List<StripePaymentGateway.CheckoutItem> items = order.getItems().stream()
                .sorted(Comparator.comparing(PurchaseOrderItem::getProductId))
                .map(item -> new StripePaymentGateway.CheckoutItem(item.getProductId(), item.getProductName(),
                        item.getQuantity(), item.getUnitPrice(), null))
                .toList();
        String leaseToken = UUID.randomUUID().toString();
        attempt.beginCreation(leaseToken, Instant.now().plusSeconds(300));
        return new CheckoutPreparation(order, items, null, leaseToken, false, true);
    }

    private CheckoutResult attachCheckout(Long orderId, String key, String leaseToken,
                                          StripePaymentGateway.CheckoutSession checkout) {
        PaymentCheckoutAttempt attempt = checkoutAttempts.findByIdForUpdate(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "A tentativa de pagamento não pôde ser recuperada."));
        if (!attempt.ownsLease(leaseToken) && !"READY".equals(attempt.getState())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Outra execução assumiu esta tentativa de checkout.");
        }
        PurchaseOrder order = orders.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "O pedido não pôde ser anexado ao checkout."));
        if (!key.equals(order.getExternalReference())) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "A tentativa de pagamento não corresponde ao pedido.");
        if (order.getCheckoutSessionId() != null && !order.getCheckoutSessionId().equals(checkout.id())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "O pedido já está vinculado a outra sessão de pagamento.");
        }
        order.attachCheckout(checkout.id(), checkout.url(), checkout.paymentIntentId());
        attempt.markReady();
        LOG.info("Stripe checkout created: orderId={} sessionId={}", order.getId(), safeId(checkout.id()));
        return new CheckoutResult(order.getId(), checkout.url());
    }

    private void compensateCheckoutCreationFailure(Long orderId, String key, String leaseToken) {
        PaymentCheckoutAttempt attempt = checkoutAttempts.findByIdForUpdate(key).orElse(null);
        if (attempt == null || !attempt.ownsLease(leaseToken)) return;
        PurchaseOrder order = orders.findByIdForUpdate(orderId).orElse(null);
        if (order == null || !key.equals(order.getExternalReference()) || order.getCheckoutSessionId() != null
                || !order.canCancelPayment()) return;
        releaseReservedInventory(order);
        order.markFailed("checkout_creation_failed");
        attempt.markFailed();
        LOG.warn("Stripe checkout creation failed: orderId={}", order.getId());
    }

    private void markCheckoutCreationUnknown(String key, String leaseToken) {
        PaymentCheckoutAttempt attempt = checkoutAttempts.findByIdForUpdate(key).orElse(null);
        if (attempt != null && attempt.ownsLease(leaseToken)) attempt.markUnknown();
    }

    private CancelPreparation prepareCancel(Long orderId, Long customerId) {
        PurchaseOrder order = customerOrderForUpdate(orderId, customerId);
        if (order.getStatus() == PaymentStatus.PAYMENT_CANCELED
                || order.getStatus() == PaymentStatus.PAYMENT_EXPIRED) {
            return new CancelPreparation(PaymentView.from(order), null, null, false);
        }
        if (order.getPaymentProvider() != PaymentProvider.STRIPE || !order.isCheckoutCancelable()
                || order.getCheckoutSessionId() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "O pagamento deste pedido não pode mais ser cancelado.");
        }
        return new CancelPreparation(PaymentView.from(order), order.getCheckoutSessionId(),
                order.getExternalReference(), true);
    }

    private PaymentView finalizeCancel(Long orderId, Long customerId) {
        PurchaseOrder order = customerOrderForUpdate(orderId, customerId);
        if (order.canCancelPayment()) {
            releaseReservedInventory(order);
            order.recordCheckoutStatus("expired");
            order.markCanceled();
            LOG.info("Stripe checkout canceled: orderId={} sessionId={}", order.getId(),
                    safeId(order.getCheckoutSessionId()));
        }
        return PaymentView.from(order);
    }

    private PaymentView currentPayment(Long orderId, Long customerId) {
        return orders.findByIdAndCustomerId(orderId, customerId).map(PaymentView::from).orElse(null);
    }

    private RefundPreparation prepareRefund(Long orderId) {
        PurchaseOrder order = orders.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido não encontrado."));
        if (order.getPaymentProvider() != PaymentProvider.STRIPE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Pagamentos legados devem ser reembolsados no provedor original.");
        }
        if ("BOLETO".equals(order.getPaymentMethod())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A Stripe não oferece reembolso de boleto. Faça uma devolução bancária separada.");
        }
        if (order.getStatus() == PaymentStatus.REFUND_PENDING && order.getRefundAttemptId() != null
                && order.getGatewayRefundId() == null) {
            return refundPreparation(order, order.getRefundAttemptId());
        }
        if (refunds.existsWithStatus(order.getId(), List.of("pending", "requires_action"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Já existe um reembolso em processamento para este pedido.");
        }
        if (!order.canRequestRefund()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Este pedido não está disponível para reembolso.");
        }
        if (order.getPaymentIntentId() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "O identificador financeiro deste pedido não está disponível.");
        }

        BigDecimal remaining = order.getTotal().subtract(order.getRefundedAmount());
        if (remaining.signum() <= 0 || remaining.compareTo(order.getTotal()) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "O pedido já foi reembolsado.");
        }
        String attemptId = UUID.randomUUID().toString();
        order.prepareRefundAttempt(attemptId, remaining);
        return new RefundPreparation(order.getPaymentIntentId(), order.getExternalReference(), attemptId,
                StripePaymentGateway.toMinorUnits(remaining));
    }

    private RefundPreparation refundPreparation(PurchaseOrder order, String attemptId) {
        long amount = StripePaymentGateway.toMinorUnits(refundAttemptAmount(order));
        if (amount <= 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "O pedido já foi reembolsado.");
        return new RefundPreparation(order.getPaymentIntentId(), order.getExternalReference(), attemptId, amount);
    }

    private static BigDecimal refundAttemptAmount(PurchaseOrder order) {
        BigDecimal persisted = order.getRefundAttemptAmount();
        BigDecimal amount = persisted == null
                ? order.getTotal().subtract(order.getRefundedAmount()) : persisted;
        if (amount.signum() <= 0 || amount.compareTo(order.getTotal()) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Valor da tentativa de reembolso inválido.");
        }
        return amount;
    }

    private PaymentView attachRefund(Long orderId, RefundPreparation preparation,
                                     StripePaymentGateway.RefundResult result) {
        PurchaseOrder order = orders.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido não encontrado."));
        if (!order.matchesRefundAttempt(preparation.attemptId())) return PaymentView.from(order);
        order.attachGatewayRefund(preparation.attemptId(), result.id());
        upsertRefund(order, result.id(), preparation.attemptId(), result.amount(), result.currency(),
                result.status(), result.created(), 1);
        if ("failed".equals(result.status()) || "canceled".equals(result.status())) {
            deriveSucceededRefundTotal(order, "refund_attach_failed");
            order.markRefundFailed("provider_refund_" + result.status());
        } else if ("succeeded".equals(result.status())) {
            deriveSucceededRefundTotal(order, "refund_attach_succeeded");
        } else {
            deriveSucceededRefundTotal(order, "refund_attach_pending");
        }
        if (result.amount() != null && result.amount() != preparation.amountMinor()) {
            LOG.error("Stripe refund amount mismatch: orderId={} refundId={}", orderId, safeId(result.id()));
        }
        LOG.info("Stripe refund requested: orderId={} paymentIntentId={} refundId={}", order.getId(),
                safeId(order.getPaymentIntentId()), safeId(result.id()));
        return PaymentView.from(order);
    }

    private void processCheckoutCompleted(VerifiedWebhookEvent event) {
        if ("paid".equals(event.paymentStatus()) || "no_payment_required".equals(event.paymentStatus())) {
            fulfillCheckout(event);
            return;
        }
        PurchaseOrder order = checkoutOrder(event);
        order.recordCheckoutStatus("complete");
        order.markProcessing(event.paymentIntentId());
        LOG.info("Stripe payment pending: orderId={} eventId={} type={}", order.getId(),
                safeId(event.id()), safeType(event.type()));
    }

    private void fulfillCheckout(VerifiedWebhookEvent event) {
        PurchaseOrder order = checkoutOrder(event);
        order.recordCheckoutStatus("complete");
        BigDecimal captured = amount(event.amountTotal());
        if (!validCheckoutPayment(order, event)) {
            order.markPaymentReviewRequired(event.paymentIntentId(), "checkout_verification_failed",
                    captured, event.currency());
            LOG.error("Stripe checkout requires review: orderId={} eventId={}", order.getId(), safeId(event.id()));
            return;
        }
        fulfill(order, event.paymentIntentId(), captured, event.currency(), event.id());
    }

    private void fulfillPaymentIntent(VerifiedWebhookEvent event) {
        PurchaseOrder order = intentOrder(event);
        BigDecimal captured = amount(event.amountTotal());
        if (!validIntentPayment(order, event)) {
            order.markPaymentReviewRequired(event.paymentIntentId(), "payment_intent_verification_failed",
                    captured, event.currency());
            LOG.error("Stripe payment intent requires review: orderId={} eventId={}",
                    order.getId(), safeId(event.id()));
            return;
        }
        fulfill(order, event.paymentIntentId(), captured, event.currency(), event.id());
    }

    private void fulfill(PurchaseOrder order, String paymentIntentId, BigDecimal captured,
                         String currency, String eventId) {
        order.markPaid(paymentIntentId, captured, currency);
        reconcileInventoryAfterFinancialUpdate(order, eventId);
        LOG.info("Stripe payment confirmed: orderId={} eventId={} paymentIntentId={}",
                order.getId(), safeId(eventId), safeId(paymentIntentId));
    }

    /**
     * Payment, refund, dispute and fulfillment are independent axes. This method is the single place
     * that turns a verified financial state into an inventory decision, including out-of-order events.
     */
    private void reconcileInventoryAfterFinancialUpdate(PurchaseOrder order, String eventId) {
        if (!order.isPaymentVerified()) return;

        if (order.getDisputeState() == DisputeState.OPEN
                || order.getRefundState() == RefundState.PENDING) {
            return;
        }
        if (order.getDisputeState() == DisputeState.LOST
                || order.getRefundState() == RefundState.FULL) {
            if (order.getInventoryStatus() == InventoryStatus.RESERVED) releaseReservedInventory(order);
            return;
        }
        if (order.getInventoryStatus() == InventoryStatus.RESERVED) {
            order.commitInventory();
            return;
        }
        if (order.getInventoryStatus() == InventoryStatus.COMMITTED) return;

        if (!deductInventory(order)) {
            order.markFulfillmentReviewRequired(order.getPaymentIntentId(), "inventory_unavailable_after_payment",
                    order.getCapturedAmount(), order.getCapturedCurrency());
            LOG.error("Paid Stripe order lacks inventory: orderId={} eventId={}",
                    order.getId(), safeId(eventId));
            return;
        }
        order.commitInventory();
    }

    private void processPaymentIntent(VerifiedWebhookEvent event) {
        PurchaseOrder order = intentOrder(event);
        order.markProcessing(event.paymentIntentId());
    }

    private void recordIntentFailure(VerifiedWebhookEvent event) {
        PurchaseOrder order = intentOrder(event);
        String code = event.failureCode() == null ? event.objectStatus() : event.failureCode();
        order.recordProcessingFailure(event.paymentIntentId(), code);
        LOG.warn("Stripe payment attempt failed: orderId={} eventId={} code={}", order.getId(),
                safeId(event.id()), safeType(code));
    }

    private void cancelPaymentIntent(VerifiedWebhookEvent event) {
        PurchaseOrder order = intentOrder(event);
        if (order.canCancelPayment()) {
            releaseReservedInventory(order);
            order.markFailed(event.failureCode() == null ? "payment_intent_canceled" : event.failureCode());
        }
        LOG.warn("Stripe payment intent canceled: orderId={} eventId={}", order.getId(), safeId(event.id()));
    }

    private void failPayment(VerifiedWebhookEvent event, String failureCode) {
        PurchaseOrder order = checkoutOrder(event);
        order.recordCheckoutStatus("complete");
        if (order.canCancelPayment()) releaseReservedInventory(order);
        order.markFailed(failureCode);
        LOG.warn("Stripe asynchronous payment failed: orderId={} eventId={} code={}", order.getId(),
                safeId(event.id()), safeType(failureCode));
    }

    private void expirePayment(VerifiedWebhookEvent event) {
        PurchaseOrder order = checkoutOrder(event);
        order.recordCheckoutStatus("expired");
        if (order.canCancelPayment()) releaseReservedInventory(order);
        order.markExpired();
        LOG.info("Stripe checkout expired: orderId={} eventId={}", order.getId(), safeId(event.id()));
    }

    private void processRefundState(VerifiedWebhookEvent event) {
        PurchaseOrder order = refundOrder(event);
        if (order == null) return;
        int rank = "refund.created".equals(event.type()) ? 1 : 2;
        if (!upsertRefund(order, event.objectId(), event.metadataRefundAttemptId(), event.amountTotal(),
                event.currency(), event.objectStatus(), event.created(), rank)) return;
        if ("failed".equals(event.objectStatus()) || "canceled".equals(event.objectStatus())) {
            deriveSucceededRefundTotal(order, event.id());
            if (isActiveRefund(order, event)) {
                order.markRefundFailed(event.failureCode() == null ? "refund_failed" : event.failureCode());
            }
        } else if ("succeeded".equals(event.objectStatus())) {
            deriveSucceededRefundTotal(order, event.id());
        } else {
            deriveSucceededRefundTotal(order, event.id());
        }
        reconcileInventoryAfterFinancialUpdate(order, event.id());
    }

    private void failRefund(VerifiedWebhookEvent event) {
        PurchaseOrder order = refundOrder(event);
        if (order == null) return;
        if (!upsertRefund(order, event.objectId(), event.metadataRefundAttemptId(), event.amountTotal(),
                event.currency(), "failed", event.created(), 3)) return;
        deriveSucceededRefundTotal(order, event.id());
        if (isActiveRefund(order, event)) {
            order.markRefundFailed(event.failureCode() == null ? "refund_failed" : event.failureCode());
        }
        reconcileInventoryAfterFinancialUpdate(order, event.id());
        LOG.warn("Stripe refund failed: orderId={} eventId={} code={}", order.getId(), safeId(event.id()),
                safeType(event.failureCode()));
    }

    private PurchaseOrder refundOrder(VerifiedWebhookEvent event) {
        PurchaseOrder order = intentOrder(event);
        if (event.integration() != null && !INTEGRATION_MARKER.equals(event.integration())
                || event.metadataOrderReference() != null
                && !Objects.equals(order.getExternalReference(), event.metadataOrderReference())) {
            LOG.error("Stripe refund metadata mismatch: orderId={} refundId={}",
                    order.getId(), safeId(event.objectId()));
            throw new UnrelatedStripeEvent();
        }
        String attemptId = event.metadataRefundAttemptId();
        if (attemptId != null && order.matchesRefundAttempt(attemptId)) {
            order.attachGatewayRefund(attemptId, event.objectId());
        }
        return order;
    }

    private void applyRefund(VerifiedWebhookEvent event) {
        PurchaseOrder order = intentOrder(event);
        if (!order.isPaymentVerified()) {
            if (validCapturedObject(order, event)) {
                order.markPaid(event.paymentIntentId(), amount(event.amountTotal()), event.currency());
            } else {
                order.markPaymentReviewRequired(event.paymentIntentId(), "refund_charge_verification_failed",
                        amount(event.amountTotal()), event.currency());
                return;
            }
        }
        long totalMinor = StripePaymentGateway.toMinorUnits(order.getTotal());
        if (event.amountRefunded() == null || event.amountRefunded() <= 0 || event.amountRefunded() > totalMinor) {
            LOG.error("Stripe refund requires review: orderId={} eventId={}", order.getId(), safeId(event.id()));
            return;
        }
        BigDecimal succeeded = refunds.sumSucceededAmount(order.getId());
        if (StripePaymentGateway.toMinorUnits(succeeded) != event.amountRefunded()) {
            LOG.warn("Stripe refund aggregate awaits individual events: orderId={} eventId={} aggregateMinor={}",
                    order.getId(), safeId(event.id()), event.amountRefunded());
            order.markExternalRefundPending();
            reconcileInventoryAfterFinancialUpdate(order, event.id());
            return;
        }
        deriveSucceededRefundTotal(order, event.id());
    }

    private void markDisputed(VerifiedWebhookEvent event) {
        PurchaseOrder order = intentOrder(event);
        if (!upsertDispute(order, event, disputeRank(event.type()))) return;
        deriveDisputeState(order, event.id());
        LOG.warn("Stripe dispute open: orderId={} eventId={}", order.getId(), safeId(event.id()));
    }

    private void closeDispute(VerifiedWebhookEvent event) {
        PurchaseOrder order = intentOrder(event);
        if (!upsertDispute(order, event, disputeRank(event.type()))) return;
        deriveDisputeState(order, event.id());
    }

    private boolean upsertDispute(PurchaseOrder order, VerifiedWebhookEvent event, int eventRank) {
        String disputeId = event.objectId();
        Long amountMinor = event.amountTotal();
        String status = event.objectStatus();
        if (disputeId == null || !disputeId.matches("dp_[A-Za-z0-9_]{8,250}")
                || amountMinor == null || amountMinor <= 0
                || amountMinor > StripePaymentGateway.toMinorUnits(order.getTotal())
                || !CURRENCY.equalsIgnoreCase(event.currency())
                || status == null || status.isBlank() || status.length() > 40) {
            LOG.error("Stripe dispute object requires review: orderId={} disputeId={}",
                    order.getId(), safeId(disputeId));
            order.markDisputed();
            return false;
        }

        long created = event.created() == null ? 0L : event.created();
        String normalizedStatus = status.toLowerCase(Locale.ROOT);
        PaymentDispute dispute = disputes.findById(disputeId).orElse(null);
        if (dispute == null) {
            disputes.save(new PaymentDispute(disputeId, order.getId(), amount(amountMinor),
                    event.currency().toLowerCase(Locale.ROOT), normalizedStatus, created, eventRank));
            return true;
        }
        if (!Objects.equals(order.getId(), dispute.getOrderId())) {
            LOG.error("Stripe dispute belongs to a different order: orderId={} disputeId={}",
                    order.getId(), safeId(disputeId));
            return false;
        }
        return dispute.apply(amount(amountMinor), event.currency().toLowerCase(Locale.ROOT),
                normalizedStatus, created, eventRank);
    }

    private void deriveDisputeState(PurchaseOrder order, String eventId) {
        disputes.flush();
        List<String> statuses = disputes.findStatuses(order.getId()).stream()
                .map(status -> status == null ? "" : status.toLowerCase(Locale.ROOT))
                .toList();
        boolean open = statuses.stream().anyMatch(status -> !isFavorableClosedDispute(status)
                && !"lost".equals(status));
        if (statuses.stream().anyMatch("lost"::equals)) {
            order.closeDisputeLost();
        } else if (open) {
            order.markDisputed();
        } else if (!statuses.isEmpty()) {
            order.closeDisputeWon();
        }
        reconcileInventoryAfterFinancialUpdate(order, eventId);
    }

    private static boolean isFavorableClosedDispute(String status) {
        return "won".equals(status) || "warning_closed".equals(status) || "prevented".equals(status);
    }

    private static int disputeRank(String eventType) {
        return switch (eventType) {
            case "charge.dispute.created" -> 1;
            case "charge.dispute.updated" -> 2;
            case "charge.dispute.funds_withdrawn", "charge.dispute.funds_reinstated" -> 3;
            case "charge.dispute.closed" -> 4;
            default -> 0;
        };
    }

    private PurchaseOrder checkoutOrder(VerifiedWebhookEvent event) {
        PurchaseOrder order = null;
        if (event.checkoutSessionId() != null) {
            order = orders.findByCheckoutSessionIdForUpdate(event.checkoutSessionId()).orElse(null);
        }
        if (order == null && INTEGRATION_MARKER.equals(event.integration()) && event.externalReference() != null) {
            order = orders.findByExternalReferenceForUpdate(event.externalReference()).orElse(null);
            if (order != null && !order.bindCheckoutIdentity(event.checkoutSessionId(), event.paymentIntentId())) {
                order.markPaymentReviewRequired(event.paymentIntentId(), "checkout_identity_mismatch",
                        amount(event.amountTotal()), event.currency());
            }
        }
        return checkedWebhookOrder(event, order);
    }

    private PurchaseOrder intentOrder(VerifiedWebhookEvent event) {
        PurchaseOrder order = null;
        if (event.paymentIntentId() != null) {
            order = orders.findByPaymentIntentIdForUpdate(event.paymentIntentId()).orElse(null);
        }
        if (order == null && INTEGRATION_MARKER.equals(event.integration())
                && event.metadataOrderReference() != null) {
            order = orders.findByExternalReferenceForUpdate(event.metadataOrderReference()).orElse(null);
        }
        if (order != null && order.getPaymentIntentId() != null && event.paymentIntentId() != null
                && !order.getPaymentIntentId().equals(event.paymentIntentId())) {
            LOG.error("Stripe event payment intent mismatch: orderId={} eventId={}",
                    order.getId(), safeId(event.id()));
            throw new UnrelatedStripeEvent();
        }
        return checkedWebhookOrder(event, order);
    }

    private PurchaseOrder checkedWebhookOrder(VerifiedWebhookEvent event, PurchaseOrder order) {
        if (order == null) {
            if (event.paymentIntentId() != null && isRecoverableIntentEvent(event.type())) {
                throw new UnresolvedStripeIntentEvent();
            }
            if (!INTEGRATION_MARKER.equals(event.integration())) throw new UnrelatedStripeEvent();
            LOG.warn("Stripe event has no matching order: eventId={} type={} objectId={}",
                    safeId(event.id()), safeType(event.type()), safeId(event.objectId()));
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Pedido ainda não está disponível para processar este evento.");
        }
        if (order.getPaymentProvider() != PaymentProvider.STRIPE) throw new UnrelatedStripeEvent();
        if (webhookEvents.existsById(event.id())) throw new AlreadyProcessedWebhook();
        return order;
    }

    private static boolean isRecoverableIntentEvent(String eventType) {
        return eventType != null && (eventType.startsWith("refund.")
                || "charge.refund.updated".equals(eventType)
                || "charge.refunded".equals(eventType)
                || eventType.startsWith("charge.dispute."));
    }

    private boolean validCheckoutPayment(PurchaseOrder order, VerifiedWebhookEvent event) {
        return INTEGRATION_MARKER.equals(event.integration())
                && Objects.equals(order.getCheckoutSessionId(), event.checkoutSessionId())
                && Objects.equals(order.getExternalReference(), event.externalReference())
                && compatiblePaymentIntent(order, event.paymentIntentId())
                && CURRENCY.equalsIgnoreCase(event.currency())
                && expectedAmount(order, event.amountTotal())
                && ("paid".equals(event.paymentStatus()) || "no_payment_required".equals(event.paymentStatus()));
    }

    private boolean validIntentPayment(PurchaseOrder order, VerifiedWebhookEvent event) {
        return INTEGRATION_MARKER.equals(event.integration())
                && compatiblePaymentIntent(order, event.paymentIntentId())
                && Objects.equals(order.getExternalReference(), event.metadataOrderReference())
                && CURRENCY.equalsIgnoreCase(event.currency())
                && expectedAmount(order, event.amountTotal())
                && "succeeded".equals(event.objectStatus());
    }

    private boolean validCapturedObject(PurchaseOrder order, VerifiedWebhookEvent event) {
        return compatiblePaymentIntent(order, event.paymentIntentId())
                && CURRENCY.equalsIgnoreCase(event.currency())
                && expectedAmount(order, event.amountTotal());
    }

    private boolean upsertRefund(PurchaseOrder order, String refundId, String attemptId, Long amountMinor,
                                 String currency, String status, Long eventCreated, int eventRank) {
        if (refundId == null || !refundId.matches("re_[A-Za-z0-9_]{8,250}") || amountMinor == null
                || amountMinor <= 0 || amountMinor > StripePaymentGateway.toMinorUnits(order.getTotal())
                || !CURRENCY.equalsIgnoreCase(currency) || status == null || status.length() > 30) {
            LOG.error("Stripe refund object requires review: orderId={} refundId={}", order.getId(), safeId(refundId));
            return false;
        }
        long created = eventCreated == null ? 0L : eventCreated;
        String normalizedAttemptId = normalizedRefundAttemptId(attemptId);
        PaymentRefund refund = refunds.findById(refundId).orElse(null);
        if (refund == null) {
            refunds.save(new PaymentRefund(refundId, order.getId(), normalizedAttemptId, amount(amountMinor),
                    currency.toLowerCase(Locale.ROOT), status, created, eventRank));
            return true;
        }
        if (!Objects.equals(order.getId(), refund.getOrderId())) {
            LOG.error("Stripe refund belongs to a different order: orderId={} refundId={}",
                    order.getId(), safeId(refundId));
            return false;
        }
        return refund.apply(normalizedAttemptId, amount(amountMinor), currency.toLowerCase(Locale.ROOT),
                status, created, eventRank);
    }

    private void deriveSucceededRefundTotal(PurchaseOrder order, String eventId) {
        refunds.flush();
        BigDecimal succeeded = refunds.sumSucceededAmount(order.getId());
        if (succeeded.compareTo(order.getTotal()) > 0) {
            LOG.error("Stripe succeeded refunds exceed order total: orderId={}", order.getId());
            return;
        }
        boolean preserveAmbiguousAttempt = order.hasActiveAmbiguousRefundAttempt();
        order.applyRefundedAmount(succeeded);
        if (preserveAmbiguousAttempt && succeeded.compareTo(order.getTotal()) < 0) {
            order.restoreAmbiguousRefundAttemptPending();
        } else if (refunds.existsWithStatus(order.getId(), List.of("pending", "requires_action"))) {
            order.markExternalRefundPending();
        }
        reconcileInventoryAfterFinancialUpdate(order, eventId);
    }

    private static String normalizedRefundAttemptId(String attemptId) {
        if (attemptId == null || !attemptId.matches(
                "[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}")) {
            return null;
        }
        return UUID.fromString(attemptId).toString();
    }

    private static boolean isActiveRefund(PurchaseOrder order, VerifiedWebhookEvent event) {
        return event.metadataRefundAttemptId() != null
                && order.matchesRefundAttempt(event.metadataRefundAttemptId())
                || event.objectId() != null && event.objectId().equals(order.getGatewayRefundId());
    }

    private boolean compatiblePaymentIntent(PurchaseOrder order, String paymentIntentId) {
        return paymentIntentId != null && (order.getPaymentIntentId() == null
                || order.getPaymentIntentId().equals(paymentIntentId));
    }

    private static boolean expectedAmount(PurchaseOrder order, Long minorAmount) {
        return minorAmount != null && minorAmount == StripePaymentGateway.toMinorUnits(order.getTotal());
    }

    private boolean deductInventory(PurchaseOrder order) {
        List<PurchaseOrderItem> items = sortedItems(order);
        List<Product> lockedProducts = new ArrayList<>();
        for (PurchaseOrderItem item : items) {
            Product product = products.findByIdForUpdate(item.getProductId()).orElse(null);
            if (product == null || product.getStockQuantity() < item.getQuantity()) return false;
            lockedProducts.add(product);
        }
        for (int index = 0; index < items.size(); index++) {
            Product product = lockedProducts.get(index);
            product.setStockQuantity(product.getStockQuantity() - items.get(index).getQuantity());
        }
        return true;
    }

    private void releaseReservedInventory(PurchaseOrder order) {
        if (order.getInventoryStatus() != InventoryStatus.RESERVED) return;
        addInventory(order);
        order.releaseInventory();
    }

    private void addInventory(PurchaseOrder order) {
        for (PurchaseOrderItem item : sortedItems(order)) {
            Product product = products.findByIdForUpdate(item.getProductId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                            "Um produto do pedido não existe mais. É necessária revisão manual."));
            product.setStockQuantity(Math.addExact(product.getStockQuantity(), item.getQuantity()));
        }
    }

    private static List<PurchaseOrderItem> sortedItems(PurchaseOrder order) {
        return order.getItems().stream().sorted(Comparator.comparing(PurchaseOrderItem::getProductId)).toList();
    }

    private PurchaseOrder customerOrderForUpdate(Long orderId, Long customerId) {
        PurchaseOrder order = orders.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido não encontrado."));
        if (!Objects.equals(customerId, order.getCustomerId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pedido não encontrado.");
        }
        return order;
    }

    private static Map<Long, Integer> aggregate(List<RequestedItem> requestedItems) {
        if (requestedItems == null || requestedItems.isEmpty() || requestedItems.size() > 100) {
            throw badRequest("O checkout deve ter entre 1 e 100 itens.");
        }
        Map<Long, Integer> quantities = new TreeMap<>();
        for (RequestedItem item : requestedItems) {
            if (item == null || item.productId() == null || item.quantity() == null || item.quantity() <= 0) {
                throw badRequest("Item do carrinho inválido.");
            }
            try {
                quantities.merge(item.productId(), item.quantity(), Math::addExact);
            } catch (ArithmeticException exception) {
                throw badRequest("Quantidade de produto inválida.");
            }
        }
        if (quantities.size() > 100) throw badRequest("O checkout aceita no máximo 100 produtos diferentes.");
        return quantities;
    }

    private static void validateProviderAmount(String paymentMethod, BigDecimal total) {
        long amount = StripePaymentGateway.toMinorUnits(total);
        if (amount < 50 || amount > MAX_STRIPE_AMOUNT) {
            throw badRequest("O total deve ficar entre R$ 0,50 e R$ 999.999,99.");
        }
        if ("PIX".equals(paymentMethod) && amount > 300_000) {
            throw badRequest("Pagamentos Pix devem ficar entre R$ 0,50 e R$ 3.000,00.");
        }
        if ("BOLETO".equals(paymentMethod) && (amount < 500 || amount > 4_999_999)) {
            throw badRequest("Pagamentos por boleto devem ficar entre R$ 5,00 e R$ 49.999,99.");
        }
    }

    private static String checkoutRequestHash(CheckoutCustomer details, Map<Long, Integer> quantities) {
        StringBuilder canonical = new StringBuilder();
        appendCanonical(canonical, details.fullName());
        appendCanonical(canonical, details.email());
        appendCanonical(canonical, details.cpf());
        appendCanonical(canonical, details.paymentMethod());
        appendCanonical(canonical, details.postalCode());
        appendCanonical(canonical, details.state());
        appendCanonical(canonical, details.city());
        appendCanonical(canonical, details.neighborhood());
        appendCanonical(canonical, details.street());
        appendCanonical(canonical, details.addressNumber());
        quantities.forEach((productId, quantity) -> {
            appendCanonical(canonical, productId.toString());
            appendCanonical(canonical, quantity.toString());
        });
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }

    private static void appendCanonical(StringBuilder target, String value) {
        String normalized = value == null ? "" : value;
        target.append(normalized.length()).append(':').append(normalized).append('|');
    }

    private static boolean constantTimeEquals(String first, String second) {
        return first != null && second != null && MessageDigest.isEqual(
                first.getBytes(StandardCharsets.US_ASCII), second.getBytes(StandardCharsets.US_ASCII));
    }

    private static void validateStripeId(String value, String prefix) {
        if (value == null || !value.matches(prefix + "[A-Za-z0-9_]{8,250}")) {
            throw badRequest("Identificador de pagamento inválido.");
        }
    }

    private static void validateWebhookEnvelope(VerifiedWebhookEvent event) {
        if (event == null || event.id() == null || event.type() == null
                || !event.id().matches("evt_[A-Za-z0-9_]{8,250}") || event.type().length() > 100
                || event.objectId() != null && event.objectId().length() > 255) {
            throw badRequest("Evento de pagamento inválido.");
        }
    }

    private static BigDecimal amount(Long minorAmount) {
        return minorAmount == null ? null : BigDecimal.valueOf(minorAmount, 2);
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static <T> T required(T value) {
        if (value == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "A operação de pagamento não pôde ser concluída.");
        return value;
    }

    private static String safeId(String value) {
        if (value == null) return "none";
        String sanitized = value.replaceAll("[^A-Za-z0-9_-]", "_");
        return sanitized.substring(0, Math.min(sanitized.length(), 255));
    }

    private static String safeType(String value) {
        if (value == null) return "none";
        return value.replaceAll("[^A-Za-z0-9_.-]", "_").toLowerCase(Locale.ROOT);
    }

    private static String shortHash(String value) {
        if (value == null) return "none";
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 6);
        } catch (NoSuchAlgorithmException impossible) {
            return "unavailable";
        }
    }

    public record CheckoutCustomer(String fullName, String email, String cpf, String paymentMethod,
                                   String postalCode, String state, String city, String neighborhood,
                                   String street, String addressNumber) { }
    public record RequestedItem(Long productId, Integer quantity) { }
    public record CheckoutResult(Long orderId, String checkoutUrl) { }
    public record PaymentView(Long orderId, String status, String paymentMethod, String paymentProvider,
                               boolean paymentVerified, boolean canCancel, BigDecimal total, BigDecimal refundedAmount,
                               java.time.Instant paidAt, java.time.Instant paymentUpdatedAt) {
        public static PaymentView from(PurchaseOrder order) {
            return new PaymentView(order.getId(), order.getStatus().name(), order.getPaymentMethod(),
                    order.getPaymentProvider().name(), order.isPaymentVerified(), order.isCheckoutCancelable(), order.getTotal(),
                    order.getRefundedAmount(), order.getPaidAt(), order.getPaymentUpdatedAt());
        }
    }

    private record CheckoutPreparation(PurchaseOrder order, List<StripePaymentGateway.CheckoutItem> items,
                                       CheckoutResult replay, String leaseToken, boolean inProgress,
                                       boolean recovery) { }
    private record CancelPreparation(PaymentView current, String checkoutSessionId, String externalReference,
                                     boolean callProvider) { }
    private record RefundPreparation(String paymentIntentId, String externalReference, String attemptId,
                                     long amountMinor) { }
    private record ReconciliationTarget(Long orderId, String checkoutSessionId, String paymentIntentId) { }
    private record RefundRecoveryTarget(Long orderId, String paymentIntentId, String externalReference,
                                        String attemptId, long amountMinor) { }
    private record RefundReconciliationTarget(Long orderId, String paymentIntentId,
                                              String externalReference) { }

    private static final class AlreadyProcessedWebhook extends RuntimeException {
        private AlreadyProcessedWebhook() { super(null, null, false, false); }
    }

    public static final class CheckoutConflictException extends ResponseStatusException {
        private final String code;

        private CheckoutConflictException(String code, String reason) {
            super(HttpStatus.CONFLICT, reason);
            this.code = code;
        }

        public String getCode() { return code; }
    }

    private static final class UnrelatedStripeEvent extends RuntimeException {
        private UnrelatedStripeEvent() { super(null, null, false, false); }
    }

    private static final class UnresolvedStripeIntentEvent extends RuntimeException {
        private UnresolvedStripeIntentEvent() { super(null, null, false, false); }
    }
}
