package com.ecommerce.hardware;

import com.ecommerce.hardware.model.DisputeState;
import com.ecommerce.hardware.model.InventoryStatus;
import com.ecommerce.hardware.model.PaymentStatus;
import com.ecommerce.hardware.model.RefundState;
import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.repository.PaymentDisputeRepository;
import com.ecommerce.hardware.repository.PaymentRefundRepository;
import com.ecommerce.hardware.repository.PaymentWebhookEventRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import com.ecommerce.hardware.service.PaymentService;
import com.ecommerce.hardware.service.StripePaymentGateway;
import com.ecommerce.hardware.service.StripePaymentGateway.CheckoutConfiguration;
import com.ecommerce.hardware.service.StripePaymentGateway.CheckoutItem;
import com.ecommerce.hardware.service.StripePaymentGateway.CheckoutSession;
import com.ecommerce.hardware.service.StripePaymentGateway.RefundResult;
import com.ecommerce.hardware.service.StripePaymentGateway.VerifiedWebhookEvent;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$vADAsIj89J6CC52LDMhGsOyh0TOFIkjGJtUFgmkZQ6SddtSMSo0Wy",
        "app.security.api-rate-limit-per-minute=1000",
        "app.stripe.reconciliation-interval-ms=86400000"
})
@AutoConfigureMockMvc
class StripePaymentIntegrationTests {

    private static final String VALID_SIGNATURE = "t=1786406400,v1=test-signature";
    private static final String INTEGRATION = "nexus_checkout_v1";
    private static final long EVENT_CREATED = 1_786_406_400L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProductRepository products;

    @Autowired
    private PurchaseOrderRepository orders;

    @Autowired
    private PaymentWebhookEventRepository webhookEvents;

    @Autowired
    private PaymentDisputeRepository disputes;

    @Autowired
    private PaymentRefundRepository refunds;

    @Autowired
    private PaymentService paymentService;

    @MockitoBean
    private StripePaymentGateway stripe;

    @Test
    void exposesDefaultPaymentMethodsAndAllowsIdempotencyKeyInCheckoutPreflight() throws Exception {
        mockMvc.perform(get("/api/payments/methods"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.methods[0]").value("CARTAO_CREDITO"))
                .andExpect(jsonPath("$.methods[1]").value("BOLETO"));

        String origin = "http://localhost:5173";
        MvcResult preflight = mockMvc.perform(options("/api/customer/payments/checkout")
                        .header(HttpHeaders.ORIGIN, origin)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS,
                                "Content-Type, X-XSRF-TOKEN, Idempotency-Key"))
                .andExpect(status().isOk())
                .andReturn();

        assertEquals(origin, preflight.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        String allowedHeaders = preflight.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS);
        assertTrue(allowedHeaders != null && allowedHeaders.toLowerCase().contains("idempotency-key"));
    }

    @Test
    void authenticatedCheckoutRequiresIdempotencyKey() throws Exception {
        MockHttpSession customer = registerCustomer("missing-key");
        Product product = product("Produto sem chave", new BigDecimal("25.00"), 3);

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 1, "CARTAO_CREDITO")))
                .andExpect(status().isBadRequest());

        verify(stripe, never()).createCheckout(any(), anyList(), anyString());
        assertEquals(3, products.findById(product.getId()).orElseThrow().getStockQuantity());
    }

    @Test
    void anonymousCheckoutIsRejectedWithoutCreatingAnOrderOrReservingStock() throws Exception {
        Product product = product("Produto para visitante", new BigDecimal("79.90"), 4);
        long ordersBeforeRequest = orders.count();

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 1, "CARTAO_CREDITO")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Faça login para continuar."));

        assertEquals(ordersBeforeRequest, orders.count());
        assertEquals(4, products.findById(product.getId()).orElseThrow().getStockQuantity());
        verify(stripe, never()).createCheckout(any(), anyList(), anyString());
    }

    @Test
    void checkoutUsesDatabasePriceReservesStockAndRetriesIdempotently() throws Exception {
        MockHttpSession customer = registerCustomer("checkout-price");
        Product product = product("SSD do banco", new BigDecimal("149.90"), 7);
        String key = UUID.randomUUID().toString();
        String sessionId = stripeId("cs_test_");
        String checkoutUrl = "https://checkout.stripe.test/" + sessionId;
        stubHostedCheckout(sessionId, checkoutUrl);

        MvcResult first = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 2, "CARTAO_CREDITO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkoutUrl").value(checkoutUrl))
                .andReturn();

        long orderId = json(first).path("orderId").asLong();
        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 2, "CARTAO_CREDITO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").value(orderId))
                .andExpect(jsonPath("$.checkoutUrl").value(checkoutUrl));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<CheckoutItem>> itemCaptor = ArgumentCaptor.forClass(List.class);
        verify(stripe, times(1)).createCheckout(any(PurchaseOrder.class), itemCaptor.capture(),
                eq("checkout-" + key));
        CheckoutItem gatewayItem = itemCaptor.getValue().getFirst();
        assertEquals(product.getId(), gatewayItem.productId());
        assertEquals(2, gatewayItem.quantity());
        assertEquals(new BigDecimal("149.90"), gatewayItem.unitPrice());

        PurchaseOrder order = orders.findById(orderId).orElseThrow();
        assertEquals(new BigDecimal("299.80"), order.getTotal());
        assertEquals(PaymentStatus.PENDING_PAYMENT, order.getStatus());
        assertEquals(InventoryStatus.RESERVED, order.getInventoryStatus());
        assertEquals(64, order.getCheckoutRequestHash().length());
        assertEquals(5, products.findById(product.getId()).orElseThrow().getStockQuantity());
    }

    @Test
    void webhookWithoutOrWithInvalidSignatureIsRejected() throws Exception {
        String payload = "{\"id\":\"evt_untrusted\"}";
        when(stripe.verifyWebhook(eq(payload), isNull()))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Webhook inválido."));
        when(stripe.verifyWebhook(eq(payload), eq("invalid")))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assinatura inválida."));

        mockMvc.perform(post("/api/payments/stripe/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/payments/stripe/webhook")
                        .header("Stripe-Signature", "invalid")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());

        verify(stripe).verifyWebhook(payload, null);
        verify(stripe).verifyWebhook(payload, "invalid");
    }

    @Test
    void signedWebhookConfirmsPaymentOnceWithoutDeductingInventoryAgain() throws Exception {
        CheckoutFixture checkout = checkout("webhook-paid", new BigDecimal("75.00"), 5, 2);
        String eventId = stripeId("evt_test_");
        String payload = "{\"id\":\"" + eventId + "\"}";
        VerifiedWebhookEvent event = checkoutEvent(eventId, "checkout.session.completed", checkout,
                "paid", checkout.totalMinorUnits());
        when(stripe.verifyWebhook(payload, VALID_SIGNATURE)).thenReturn(event);

        postWebhook(payload).andExpect(status().isOk()).andExpect(jsonPath("$.received").value(true));
        postWebhook(payload).andExpect(status().isOk()).andExpect(jsonPath("$.received").value(true));

        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.PAID, order.getStatus());
        assertEquals(InventoryStatus.COMMITTED, order.getInventoryStatus());
        assertEquals(checkout.paymentIntentId(), order.getPaymentIntentId());
        assertTrue(order.isPaymentVerified());
        assertEquals(3, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
        assertTrue(webhookEvents.existsById(eventId));
        verify(stripe, times(2)).verifyWebhook(payload, VALID_SIGNATURE);
    }

    @Test
    void asynchronousPaymentFailureReleasesReservedInventory() throws Exception {
        CheckoutFixture checkout = checkout("webhook-failed", new BigDecimal("41.50"), 4, 3);
        assertEquals(1, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
        String eventId = stripeId("evt_test_");
        String payload = "{\"id\":\"" + eventId + "\"}";
        VerifiedWebhookEvent event = checkoutEvent(eventId, "checkout.session.async_payment_failed", checkout,
                "unpaid", checkout.totalMinorUnits());
        when(stripe.verifyWebhook(payload, VALID_SIGNATURE)).thenReturn(event);

        postWebhook(payload).andExpect(status().isOk());

        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.PAYMENT_FAILED, order.getStatus());
        assertEquals(InventoryStatus.RELEASED, order.getInventoryStatus());
        assertEquals("async_payment_failed", order.getPaymentFailureCode());
        assertEquals(4, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
    }

    @Test
    void completedCheckoutWithUnpaidPaymentCannotBeCanceledAndKeepsInventoryReserved() throws Exception {
        CheckoutFixture checkout = checkout("completed-unpaid", new BigDecimal("32.50"), 5, 2);
        String eventId = stripeId("evt_unpaid_");
        String payload = "{\"id\":\"" + eventId + "\"}";
        when(stripe.verifyWebhook(payload, VALID_SIGNATURE)).thenReturn(
                checkoutEvent(eventId, "checkout.session.completed", checkout, "unpaid",
                        checkout.totalMinorUnits()));

        postWebhook(payload).andExpect(status().isOk());

        mockMvc.perform(get("/api/customer/payments/orders/{orderId}/status", checkout.orderId())
                        .session(checkout.customerSession()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAYMENT_PROCESSING"))
                .andExpect(jsonPath("$.paymentVerified").value(false))
                .andExpect(jsonPath("$.canCancel").value(false));

        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.PAYMENT_PROCESSING, order.getStatus());
        assertEquals(InventoryStatus.RESERVED, order.getInventoryStatus());
        assertEquals(3, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
    }

    @Test
    void paymentIntentFailureRemainsRetryableAndLaterCheckoutSuccessCommitsTheSameReservation() throws Exception {
        CheckoutFixture checkout = checkout("intent-retry", new BigDecimal("60.00"), 5, 2);
        String failedEventId = stripeId("evt_failed_");
        String failedPayload = "{\"id\":\"" + failedEventId + "\"}";
        VerifiedWebhookEvent failed = new VerifiedWebhookEvent(failedEventId, "payment_intent.payment_failed",
                EVENT_CREATED, checkout.paymentIntentId(), null, null, checkout.paymentIntentId(), null,
                "requires_payment_method", "brl", checkout.totalMinorUnits(), null, "card_declined",
                checkout.idempotencyKey(), null, INTEGRATION);
        when(stripe.verifyWebhook(failedPayload, VALID_SIGNATURE)).thenReturn(failed);

        postWebhook(failedPayload).andExpect(status().isOk());

        PurchaseOrder afterFailure = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.PAYMENT_PROCESSING, afterFailure.getStatus());
        assertEquals(InventoryStatus.RESERVED, afterFailure.getInventoryStatus());
        assertEquals("card_declined", afterFailure.getPaymentFailureCode());
        assertEquals(3, products.findById(checkout.productId()).orElseThrow().getStockQuantity());

        String paidEventId = stripeId("evt_retry_paid_");
        String paidPayload = "{\"id\":\"" + paidEventId + "\"}";
        when(stripe.verifyWebhook(paidPayload, VALID_SIGNATURE)).thenReturn(
                checkoutEvent(paidEventId, "checkout.session.completed", checkout, "paid",
                        checkout.totalMinorUnits()));
        postWebhook(paidPayload).andExpect(status().isOk());

        PurchaseOrder paid = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.PAID, paid.getStatus());
        assertEquals(InventoryStatus.COMMITTED, paid.getInventoryStatus());
        assertEquals(3, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
    }

    @Test
    void paymentStatusIsVisibleOnlyToTheOwningCustomer() throws Exception {
        CheckoutFixture checkout = checkout("status-owner", new BigDecimal("89.90"), 2, 1);
        MockHttpSession otherCustomer = registerCustomer("status-other");

        mockMvc.perform(get("/api/customer/payments/status")
                        .session(checkout.customerSession())
                        .param("sessionId", checkout.checkoutSessionId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").value(checkout.orderId()));

        mockMvc.perform(get("/api/customer/payments/status")
                        .session(otherCustomer)
                        .param("sessionId", checkout.checkoutSessionId()))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/customer/payments/orders/{orderId}/status", checkout.orderId())
                        .session(otherCustomer))
                .andExpect(status().isNotFound());
    }

    @Test
    void customerCancellationExpiresCheckoutAndReleasesInventoryOnce() throws Exception {
        CheckoutFixture checkout = checkout("cancel", new BigDecimal("110.00"), 6, 2);

        mockMvc.perform(post("/api/customer/payments/orders/{orderId}/cancel", checkout.orderId())
                        .with(csrf())
                        .session(checkout.customerSession()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAYMENT_CANCELED"));
        mockMvc.perform(post("/api/customer/payments/orders/{orderId}/cancel", checkout.orderId())
                        .with(csrf())
                        .session(checkout.customerSession()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAYMENT_CANCELED"));

        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(InventoryStatus.RELEASED, order.getInventoryStatus());
        assertEquals(6, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
        verify(stripe, times(1)).expireCheckout(checkout.checkoutSessionId(),
                "expire-" + checkout.idempotencyKey());
    }

    @Test
    void administratorCanRequestRefundAndSignedWebhookCompletesItOnce() throws Exception {
        CheckoutFixture checkout = checkout("refund", new BigDecimal("10.99"), 5, 2);
        String paidEventId = stripeId("evt_paid_");
        String paidPayload = "{\"id\":\"" + paidEventId + "\"}";
        when(stripe.verifyWebhook(paidPayload, VALID_SIGNATURE)).thenReturn(
                checkoutEvent(paidEventId, "checkout.session.completed", checkout, "paid",
                        checkout.totalMinorUnits()));
        postWebhook(paidPayload).andExpect(status().isOk());

        String adminToken = loginAdmin();
        String refundId = stripeId("re_test_");
        when(stripe.refund(eq(checkout.paymentIntentId()), eq(checkout.totalMinorUnits()),
                eq(checkout.idempotencyKey()), anyString(), anyString()))
                .thenReturn(new RefundResult(refundId, "pending", checkout.totalMinorUnits(), "brl",
                        EVENT_CREATED));
        mockMvc.perform(post("/api/admin/orders/{orderId}/refund", checkout.orderId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REFUND_PENDING"));

        PurchaseOrder pendingRefund = orders.findById(checkout.orderId()).orElseThrow();
        String attemptId = pendingRefund.getRefundAttemptId();
        assertEquals(refundId, pendingRefund.getGatewayRefundId());

        String refundEventId = stripeId("evt_refund_");
        String refundPayload = "{\"id\":\"" + refundEventId + "\"}";
        VerifiedWebhookEvent refunded = refundObjectEvent(refundEventId, "refund.updated", refundId,
                checkout, checkout.totalMinorUnits(), "succeeded", EVENT_CREATED + 1, attemptId);
        when(stripe.verifyWebhook(refundPayload, VALID_SIGNATURE)).thenReturn(refunded);
        postWebhook(refundPayload).andExpect(status().isOk());
        postWebhook(refundPayload).andExpect(status().isOk());

        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.REFUNDED, order.getStatus());
        assertEquals(new BigDecimal("21.98"), order.getRefundedAmount());
        assertEquals(InventoryStatus.COMMITTED, order.getInventoryStatus());
        assertEquals(3, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
        verify(stripe, times(1)).refund(checkout.paymentIntentId(), checkout.totalMinorUnits(),
                checkout.idempotencyKey(), attemptId, "refund-" + attemptId);
    }

    @Test
    void cumulativeRefundEventsCannotRegressACompletedRefund() throws Exception {
        CheckoutFixture checkout = checkout("refund-ordering", new BigDecimal("50.00"), 4, 2);
        String paidEventId = stripeId("evt_paid_");
        String paidPayload = "{\"id\":\"" + paidEventId + "\"}";
        when(stripe.verifyWebhook(paidPayload, VALID_SIGNATURE)).thenReturn(
                checkoutEvent(paidEventId, "checkout.session.completed", checkout, "paid",
                        checkout.totalMinorUnits()));
        postWebhook(paidPayload).andExpect(status().isOk());

        String refundId = stripeId("re_test_");
        String fullEventId = stripeId("evt_refund_full_");
        String fullPayload = "{\"id\":\"" + fullEventId + "\"}";
        when(stripe.verifyWebhook(fullPayload, VALID_SIGNATURE)).thenReturn(
                refundObjectEvent(fullEventId, "refund.updated", refundId, checkout,
                        checkout.totalMinorUnits(), "succeeded", EVENT_CREATED + 10, null));
        postWebhook(fullPayload).andExpect(status().isOk());

        String aggregateFullId = stripeId("evt_charge_refund_full_");
        String aggregateFullPayload = "{\"id\":\"" + aggregateFullId + "\"}";
        when(stripe.verifyWebhook(aggregateFullPayload, VALID_SIGNATURE)).thenReturn(
                chargeRefundedEvent(aggregateFullId, checkout, checkout.totalMinorUnits()));
        postWebhook(aggregateFullPayload).andExpect(status().isOk());

        String staleAggregateId = stripeId("evt_charge_refund_partial_");
        String staleAggregatePayload = "{\"id\":\"" + staleAggregateId + "\"}";
        when(stripe.verifyWebhook(staleAggregatePayload, VALID_SIGNATURE)).thenReturn(
                chargeRefundedEvent(staleAggregateId, checkout, checkout.totalMinorUnits() / 2));
        postWebhook(staleAggregatePayload).andExpect(status().isOk());

        String stalePendingEventId = stripeId("evt_refund_pending_");
        String stalePendingPayload = "{\"id\":\"" + stalePendingEventId + "\"}";
        when(stripe.verifyWebhook(stalePendingPayload, VALID_SIGNATURE)).thenReturn(
                refundObjectEvent(stalePendingEventId, "refund.created", refundId, checkout,
                        checkout.totalMinorUnits(), "pending", EVENT_CREATED, null));
        postWebhook(stalePendingPayload).andExpect(status().isOk());

        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.REFUNDED, order.getStatus());
        assertEquals(new BigDecimal("100.00"), order.getRefundedAmount());
        assertEquals(InventoryStatus.COMMITTED, order.getInventoryStatus());
        assertEquals(2, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
    }

    @Test
    void succeededRefundDoesNotRegressToPendingAtTheSameStripeTimestamp() throws Exception {
        CheckoutFixture checkout = checkout("refund-same-time", new BigDecimal("24.00"), 3, 2);
        confirmPaid(checkout);
        String refundId = stripeId("re_test_");
        long created = EVENT_CREATED + 50;

        String succeededEventId = stripeId("evt_refund_succeeded_");
        String succeededPayload = "{\"id\":\"" + succeededEventId + "\"}";
        when(stripe.verifyWebhook(succeededPayload, VALID_SIGNATURE)).thenReturn(
                refundObjectEvent(succeededEventId, "refund.updated", refundId, checkout,
                        checkout.totalMinorUnits(), "succeeded", created, null));
        postWebhook(succeededPayload).andExpect(status().isOk());

        String pendingEventId = stripeId("evt_refund_pending_");
        String pendingPayload = "{\"id\":\"" + pendingEventId + "\"}";
        when(stripe.verifyWebhook(pendingPayload, VALID_SIGNATURE)).thenReturn(
                refundObjectEvent(pendingEventId, "refund.updated", refundId, checkout,
                        checkout.totalMinorUnits(), "pending", created, null));
        postWebhook(pendingPayload).andExpect(status().isOk());

        assertEquals("succeeded", refunds.findById(refundId).orElseThrow().getStatus());
        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.REFUNDED, order.getStatus());
        assertEquals(new BigDecimal("48.00"), order.getRefundedAmount());
    }

    @Test
    void aggregateRefundBeforeIndividualRefundKeepsPaidInventoryReserved() throws Exception {
        CheckoutFixture checkout = checkout("aggregate-first", new BigDecimal("40.00"), 5, 2);
        String aggregateEventId = stripeId("evt_charge_refunded_");
        String aggregatePayload = "{\"id\":\"" + aggregateEventId + "\"}";
        when(stripe.verifyWebhook(aggregatePayload, VALID_SIGNATURE)).thenReturn(
                chargeRefundedEvent(aggregateEventId, checkout, checkout.totalMinorUnits()));

        postWebhook(aggregatePayload).andExpect(status().isOk());

        PurchaseOrder pending = orders.findById(checkout.orderId()).orElseThrow();
        assertTrue(pending.isPaymentVerified());
        assertEquals(PaymentStatus.REFUND_PENDING, pending.getStatus());
        assertEquals(RefundState.PENDING, pending.getRefundState());
        assertEquals(InventoryStatus.RESERVED, pending.getInventoryStatus());
        assertEquals(3, products.findById(checkout.productId()).orElseThrow().getStockQuantity());

        when(stripe.listRefunds(checkout.paymentIntentId())).thenReturn(List.of());
        paymentService.reconcileDuePayments();

        PurchaseOrder afterEmptySnapshot = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.REFUND_PENDING, afterEmptySnapshot.getStatus());
        assertEquals(InventoryStatus.RESERVED, afterEmptySnapshot.getInventoryStatus());
        assertEquals(3, products.findById(checkout.productId()).orElseThrow().getStockQuantity());

        String refundId = stripeId("re_test_");
        String individualEventId = stripeId("evt_refund_individual_");
        String individualPayload = "{\"id\":\"" + individualEventId + "\"}";
        when(stripe.verifyWebhook(individualPayload, VALID_SIGNATURE)).thenReturn(
                refundObjectEvent(individualEventId, "refund.updated", refundId, checkout,
                        checkout.totalMinorUnits(), "succeeded", EVENT_CREATED + 1, null));
        postWebhook(individualPayload).andExpect(status().isOk());

        PurchaseOrder refunded = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.REFUNDED, refunded.getStatus());
        assertEquals(InventoryStatus.RELEASED, refunded.getInventoryStatus());
        assertEquals(5, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
    }

    @Test
    void pendingRefundBeforeCaptureBlocksInventoryCommitAfterPaymentSucceeds() throws Exception {
        CheckoutFixture checkout = checkout("refund-before-capture", new BigDecimal("37.00"), 5, 2);
        String refundId = stripeId("re_pending_");
        String refundEventId = stripeId("evt_refund_pending_");
        String refundPayload = "{\"id\":\"" + refundEventId + "\"}";
        when(stripe.verifyWebhook(refundPayload, VALID_SIGNATURE)).thenReturn(
                refundObjectEvent(refundEventId, "refund.created", refundId, checkout,
                        checkout.totalMinorUnits(), "pending", EVENT_CREATED, null));

        postWebhook(refundPayload).andExpect(status().isOk());

        PurchaseOrder beforeCapture = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.REFUND_PENDING, beforeCapture.getStatus());
        assertEquals(RefundState.PENDING, beforeCapture.getRefundState());
        assertTrue(!beforeCapture.isPaymentVerified());
        assertEquals(InventoryStatus.RESERVED, beforeCapture.getInventoryStatus());

        confirmPaid(checkout);

        PurchaseOrder afterCapture = orders.findById(checkout.orderId()).orElseThrow();
        assertTrue(afterCapture.isPaymentVerified());
        assertEquals(PaymentStatus.REFUND_PENDING, afterCapture.getStatus());
        assertEquals(InventoryStatus.RESERVED, afterCapture.getInventoryStatus());
        assertEquals(3, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
    }

    @Test
    void reconciliationListsRefundsByPaymentIntentAndRejectsMismatchedIdentity() throws Exception {
        CheckoutFixture checkout = checkout("refund-list", new BigDecimal("45.00"), 4, 2);
        String aggregateEventId = stripeId("evt_charge_refunded_");
        String aggregatePayload = "{\"id\":\"" + aggregateEventId + "\"}";
        when(stripe.verifyWebhook(aggregatePayload, VALID_SIGNATURE)).thenReturn(
                chargeRefundedEvent(aggregateEventId, checkout, checkout.totalMinorUnits()));
        postWebhook(aggregatePayload).andExpect(status().isOk());

        String wrongIntentRefundId = stripeId("re_wrong_pi_");
        String wrongReferenceRefundId = stripeId("re_wrong_ref_");
        String validRefundId = stripeId("re_listed_");
        when(stripe.listRefunds(checkout.paymentIntentId())).thenReturn(List.of(
                new RefundResult(wrongIntentRefundId, "succeeded", checkout.totalMinorUnits(), "brl",
                        EVENT_CREATED, stripeId("pi_other_"), null, null, null),
                new RefundResult(wrongReferenceRefundId, "succeeded", checkout.totalMinorUnits(), "brl",
                        EVENT_CREATED, checkout.paymentIntentId(), "another-order", null, INTEGRATION),
                new RefundResult(validRefundId, "succeeded", checkout.totalMinorUnits(), "brl",
                        EVENT_CREATED, checkout.paymentIntentId(), null, null, null)));

        paymentService.reconcileDuePayments();

        assertTrue(refunds.findById(wrongIntentRefundId).isEmpty());
        assertTrue(refunds.findById(wrongReferenceRefundId).isEmpty());
        assertEquals(checkout.orderId(), refunds.findById(validRefundId).orElseThrow().getOrderId());
        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.REFUNDED, order.getStatus());
        assertEquals(RefundState.FULL, order.getRefundState());
        assertEquals(BigDecimal.valueOf(checkout.totalMinorUnits(), 2), order.getRefundedAmount());
        assertEquals(InventoryStatus.RELEASED, order.getInventoryStatus());
    }

    @Test
    void externalPartialRefundDoesNotEraseActiveAmbiguousRefundAttempt() throws Exception {
        CheckoutFixture checkout = checkout("ambiguous-partial", new BigDecimal("55.00"), 4, 2);
        confirmPaid(checkout);
        String recoveredRefundId = stripeId("re_recovered_");
        when(stripe.refund(eq(checkout.paymentIntentId()), eq(checkout.totalMinorUnits()),
                eq(checkout.idempotencyKey()), anyString(), anyString()))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "provider timeout"))
                .thenReturn(new RefundResult(recoveredRefundId, "pending", checkout.totalMinorUnits(),
                        "brl", EVENT_CREATED + 2));

        mockMvc.perform(post("/api/admin/orders/{orderId}/refund", checkout.orderId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + loginAdmin()))
                .andExpect(status().isBadGateway());
        PurchaseOrder ambiguous = orders.findById(checkout.orderId()).orElseThrow();
        String attemptId = ambiguous.getRefundAttemptId();
        assertEquals(RefundState.PENDING, ambiguous.getRefundState());
        assertEquals(null, ambiguous.getGatewayRefundId());

        String externalRefundId = stripeId("re_external_");
        String externalEventId = stripeId("evt_external_refund_");
        String externalPayload = "{\"id\":\"" + externalEventId + "\"}";
        when(stripe.verifyWebhook(externalPayload, VALID_SIGNATURE)).thenReturn(
                refundObjectEvent(externalEventId, "refund.updated", externalRefundId, checkout,
                        checkout.totalMinorUnits() / 2, "succeeded", EVENT_CREATED + 1, null));
        postWebhook(externalPayload).andExpect(status().isOk());

        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.REFUND_PENDING, order.getStatus());
        assertEquals(RefundState.PENDING, order.getRefundState());
        assertEquals(attemptId, order.getRefundAttemptId());
        assertEquals(null, order.getGatewayRefundId());
        assertEquals(BigDecimal.valueOf(checkout.totalMinorUnits() / 2, 2), order.getRefundedAmount());

        when(stripe.listRefunds(checkout.paymentIntentId())).thenReturn(List.of(
                new RefundResult(externalRefundId, "succeeded", checkout.totalMinorUnits() / 2, "brl",
                        EVENT_CREATED + 1, checkout.paymentIntentId(), null, null, null)));
        paymentService.reconcileDuePayments();

        verify(stripe, times(2)).refund(checkout.paymentIntentId(), checkout.totalMinorUnits(),
                checkout.idempotencyKey(), attemptId, "refund-" + attemptId);
        PurchaseOrder recovered = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(recoveredRefundId, recovered.getGatewayRefundId());
        assertEquals(BigDecimal.valueOf(checkout.totalMinorUnits(), 2), recovered.getRefundAttemptAmount());
    }

    @Test
    void fullExternalRefundSupersedesRedundantAmbiguousAttempt() throws Exception {
        CheckoutFixture checkout = checkout("ambiguous-full", new BigDecimal("29.00"), 4, 2);
        confirmPaid(checkout);
        when(stripe.refund(eq(checkout.paymentIntentId()), eq(checkout.totalMinorUnits()),
                eq(checkout.idempotencyKey()), anyString(), anyString()))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "provider timeout"));
        mockMvc.perform(post("/api/admin/orders/{orderId}/refund", checkout.orderId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + loginAdmin()))
                .andExpect(status().isBadGateway());

        String externalRefundId = stripeId("re_external_full_");
        String externalEventId = stripeId("evt_external_full_");
        String externalPayload = "{\"id\":\"" + externalEventId + "\"}";
        when(stripe.verifyWebhook(externalPayload, VALID_SIGNATURE)).thenReturn(
                refundObjectEvent(externalEventId, "refund.updated", externalRefundId, checkout,
                        checkout.totalMinorUnits(), "succeeded", EVENT_CREATED + 1, null));
        postWebhook(externalPayload).andExpect(status().isOk());

        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(PaymentStatus.REFUNDED, order.getStatus());
        assertEquals(RefundState.FULL, order.getRefundState());
    }

    @Test
    void disputeLedgerUsesStripeDisputeIdsAndLostPlusOpenRemainsConservative() throws Exception {
        CheckoutFixture checkout = checkout("multiple-disputes", new BigDecimal("70.00"), 4, 1);
        confirmPaid(checkout);
        String disputeA = stripeId("dp_test_");
        String disputeB = stripeId("dp_test_");

        String openAId = stripeId("evt_dispute_a_open_");
        String openAPayload = "{\"id\":\"" + openAId + "\"}";
        when(stripe.verifyWebhook(openAPayload, VALID_SIGNATURE)).thenReturn(
                disputeEvent(openAId, "charge.dispute.created", disputeA, checkout,
                        "needs_response", EVENT_CREATED + 1));
        postWebhook(openAPayload).andExpect(status().isOk());

        String openBId = stripeId("evt_dispute_b_open_");
        String openBPayload = "{\"id\":\"" + openBId + "\"}";
        when(stripe.verifyWebhook(openBPayload, VALID_SIGNATURE)).thenReturn(
                disputeEvent(openBId, "charge.dispute.created", disputeB, checkout,
                        "under_review", EVENT_CREATED + 2));
        postWebhook(openBPayload).andExpect(status().isOk());

        String lostAId = stripeId("evt_dispute_a_lost_");
        String lostAPayload = "{\"id\":\"" + lostAId + "\"}";
        when(stripe.verifyWebhook(lostAPayload, VALID_SIGNATURE)).thenReturn(
                disputeEvent(lostAId, "charge.dispute.closed", disputeA, checkout,
                        "lost", EVENT_CREATED + 3));
        postWebhook(lostAPayload).andExpect(status().isOk());

        assertEquals("lost", disputes.findById(disputeA).orElseThrow().getStatus());
        assertEquals("under_review", disputes.findById(disputeB).orElseThrow().getStatus());
        assertTrue(webhookEvents.existsById(openAId));
        assertTrue(webhookEvents.existsById(openBId));
        assertTrue(webhookEvents.existsById(lostAId));
        PurchaseOrder order = orders.findById(checkout.orderId()).orElseThrow();
        assertEquals(DisputeState.LOST, order.getDisputeState());
        assertEquals(PaymentStatus.DISPUTE_LOST, order.getStatus());
        assertEquals(InventoryStatus.COMMITTED, order.getInventoryStatus());
        assertEquals(3, products.findById(checkout.productId()).orElseThrow().getStockQuantity());
    }

    @Test
    void alternateNumericOrderIdsCannotBypassAdministratorBearerRequirement() throws Exception {
        MockHttpSession adminSession = loginAdminSession();

        mockMvc.perform(post("/api/admin/orders/099999999/refund").session(adminSession))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/admin/orders/+99999999/refund").session(adminSession))
                .andExpect(status().isForbidden());

        verify(stripe, never()).refund(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    private CheckoutFixture checkout(String usernamePrefix, BigDecimal unitPrice, int stock, int quantity)
            throws Exception {
        MockHttpSession customer = registerCustomer(usernamePrefix);
        Product product = product("Produto " + usernamePrefix, unitPrice, stock);
        String key = UUID.randomUUID().toString();
        String checkoutSessionId = stripeId("cs_test_");
        String paymentIntentId = stripeId("pi_test_");
        String checkoutUrl = "https://checkout.stripe.test/" + checkoutSessionId;
        stubHostedCheckout(checkoutSessionId, checkoutUrl);

        MvcResult response = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), quantity, "CARTAO_CREDITO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkoutUrl").value(checkoutUrl))
                .andReturn();
        long totalMinor = StripePaymentGateway.toMinorUnits(unitPrice.multiply(BigDecimal.valueOf(quantity)));
        return new CheckoutFixture(customer, product.getId(), key, checkoutSessionId, paymentIntentId,
                json(response).path("orderId").asLong(), totalMinor);
    }

    private MockHttpSession registerCustomer(String prefix) throws Exception {
        MockHttpSession session = new MockHttpSession();
        String username = prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
        mockMvc.perform(post("/api/customer/auth/register")
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"senha123\"}"))
                .andExpect(status().isCreated());
        return session;
    }

    private void confirmPaid(CheckoutFixture checkout) throws Exception {
        String eventId = stripeId("evt_paid_");
        String payload = "{\"id\":\"" + eventId + "\"}";
        when(stripe.verifyWebhook(payload, VALID_SIGNATURE)).thenReturn(
                checkoutEvent(eventId, "checkout.session.completed", checkout, "paid",
                        checkout.totalMinorUnits()));
        postWebhook(payload).andExpect(status().isOk());
    }

    private void stubHostedCheckout(String sessionId, String checkoutUrl) {
        when(stripe.checkoutConfiguration(anyLong())).thenReturn(new CheckoutConfiguration(
                Instant.now().plusSeconds(3_600),
                "https://store.example.test/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}",
                "https://store.example.test/pagamento/cancelado", 1_800L, 1L));
        when(stripe.createCheckout(any(PurchaseOrder.class), anyList(), anyString()))
                .thenReturn(new CheckoutSession(sessionId, checkoutUrl, null));
    }

    private Product product(String name, BigDecimal price, int stock) {
        Product product = new Product(null, name, "Teste", price,
                "https://example.test/product.png", "Produto de teste");
        product.setStockQuantity(stock);
        return products.saveAndFlush(product);
    }

    private String loginAdmin() throws Exception {
        MvcResult login = mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return json(login).path("accessToken").asText();
    }

    private MockHttpSession loginAdminSession() throws Exception {
        MockHttpSession session = new MockHttpSession();
        mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk());
        return session;
    }

    private org.springframework.test.web.servlet.ResultActions postWebhook(String payload) throws Exception {
        return mockMvc.perform(post("/api/payments/stripe/webhook")
                .header("Stripe-Signature", VALID_SIGNATURE)
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload));
    }

    private static VerifiedWebhookEvent checkoutEvent(String id, String type, CheckoutFixture checkout,
                                                       String paymentStatus, long amountTotal) {
        return new VerifiedWebhookEvent(id, type, EVENT_CREATED, checkout.checkoutSessionId(),
                checkout.checkoutSessionId(), checkout.idempotencyKey(), checkout.paymentIntentId(), paymentStatus,
                "complete", "brl", amountTotal, null, null, checkout.idempotencyKey(), null, INTEGRATION);
    }

    private static VerifiedWebhookEvent refundObjectEvent(String id, String type, String refundId,
                                                           CheckoutFixture checkout, long refundAmount,
                                                           String objectStatus, long created,
                                                           String refundAttemptId) {
        return new VerifiedWebhookEvent(id, type, created, refundId, null, null,
                checkout.paymentIntentId(), null, objectStatus, "brl", refundAmount,
                null, null, checkout.idempotencyKey(), refundAttemptId, INTEGRATION);
    }

    private static VerifiedWebhookEvent chargeRefundedEvent(String id, CheckoutFixture checkout,
                                                             long cumulativeRefunded) {
        return new VerifiedWebhookEvent(id, "charge.refunded", EVENT_CREATED, stripeId("ch_test_"),
                null, null, checkout.paymentIntentId(), null, "succeeded", "brl",
                checkout.totalMinorUnits(), cumulativeRefunded, null, checkout.idempotencyKey(), null,
                INTEGRATION);
    }

    private static VerifiedWebhookEvent disputeEvent(String eventId, String type, String disputeId,
                                                       CheckoutFixture checkout, String disputeStatus,
                                                       long created) {
        return new VerifiedWebhookEvent(eventId, type, created, disputeId, null, null,
                checkout.paymentIntentId(), null, disputeStatus, "brl", checkout.totalMinorUnits(),
                null, null, checkout.idempotencyKey(), null, INTEGRATION);
    }

    private static String checkoutBody(Long productId, int quantity, String paymentMethod) {
        return "{\"fullName\":\"Cliente de Teste\",\"email\":\"cliente@example.test\","
                + "\"cpf\":\"529.982.247-25\",\"paymentMethod\":\"" + paymentMethod + "\","
                + "\"postalCode\":\"01001-000\",\"state\":\"SP\",\"city\":\"Sao Paulo\","
                + "\"neighborhood\":\"Centro\",\"street\":\"Rua de Teste\",\"addressNumber\":\"100\","
                + "\"items\":[{\"productId\":" + productId + ",\"quantity\":" + quantity + "}]}";
    }

    private static JsonNode json(MvcResult result) throws Exception {
        return JsonMapper.shared().readTree(result.getResponse().getContentAsString());
    }

    private static String stripeId(String prefix) {
        return prefix + UUID.randomUUID().toString().replace("-", "");
    }

    private record CheckoutFixture(MockHttpSession customerSession, Long productId, String idempotencyKey,
                                   String checkoutSessionId, String paymentIntentId, long orderId,
                                   long totalMinorUnits) { }
}
