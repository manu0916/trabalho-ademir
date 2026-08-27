package com.ecommerce.hardware;

import com.ecommerce.hardware.config.StoreProperties;
import com.ecommerce.hardware.model.InventoryStatus;
import com.ecommerce.hardware.model.PaymentProvider;
import com.ecommerce.hardware.model.PaymentState;
import com.ecommerce.hardware.model.PaymentStatus;
import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import com.ecommerce.hardware.service.WhatsappCheckoutService;
import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$vADAsIj89J6CC52LDMhGsOyh0TOFIkjGJtUFgmkZQ6SddtSMSo0Wy",
        "app.security.api-rate-limit-per-minute=1000",
        "app.stripe.reconciliation-interval-ms=86400000",
        "app.store.whatsapp-number=5535991526318",
        "app.store.whatsapp-expiry-minutes=60"
})
@AutoConfigureMockMvc
class WhatsappCheckoutIntegrationTests {

    private static final String STORE_PHONE = "5535991526318";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProductRepository products;

    @Autowired
    private PurchaseOrderRepository orders;

    @Autowired
    private CustomerAccountRepository accounts;

    @Autowired
    private StoreProperties storeProperties;

    @Autowired
    private WhatsappCheckoutService whatsappCheckoutService;

    @BeforeEach
    void resetConfig() {
        storeProperties.setWhatsappNumber(STORE_PHONE);
        storeProperties.setWhatsappExpiryMinutes(60);
    }

    // ── 1. PII Check: WhatsApp URL and text contain NO personal data ──────────

    @Test
    void whatsappUrlContainsNoPersonalDataOrProductNames() throws Exception {
        MockHttpSession customer = registerCustomer("pii-user");
        Product product = product("Tênis Basquete High 01", new BigDecimal("399.90"), 5);
        String key = UUID.randomUUID().toString();

        String body = "{\"fullName\":\"Maria da Silva Santos\",\"email\":\"maria.silva@example.test\","
                + "\"cpf\":\"529.982.247-25\",\"postalCode\":\"01001-000\",\"state\":\"SP\","
                + "\"city\":\"Sao Paulo\",\"neighborhood\":\"Centro\",\"street\":\"Avenida Paulista\","
                + "\"addressNumber\":\"1500\",\"complement\":\"Apto 42\","
                + "\"items\":[{\"productId\":" + product.getId() + ",\"quantity\":2}]}";

        MvcResult result = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = json(result);
        String whatsappUrl = json.path("whatsappUrl").asText();
        assertNotNull(whatsappUrl);
        assertTrue(whatsappUrl.startsWith("https://wa.me/" + STORE_PHONE));

        String decodedUrl = URLDecoder.decode(whatsappUrl, StandardCharsets.UTF_8);

        // Assert NO PII is present in the URL
        assertFalse(decodedUrl.contains("Maria"), "URL must not contain customer name");
        assertFalse(decodedUrl.contains("Silva"), "URL must not contain customer name");
        assertFalse(decodedUrl.contains("maria.silva"), "URL must not contain customer email");
        assertFalse(decodedUrl.contains("529.982"), "URL must not contain customer CPF");
        assertFalse(decodedUrl.contains("529982"), "URL must not contain customer CPF");
        assertFalse(decodedUrl.contains("Paulista"), "URL must not contain customer street");
        assertFalse(decodedUrl.contains("1500"), "URL must not contain customer address number");
        assertFalse(decodedUrl.contains("Apto 42"), "URL must not contain customer address complement");
        assertFalse(decodedUrl.contains("01001"), "URL must not contain customer postal code");
        assertFalse(decodedUrl.contains("Basquete"), "URL must not contain product names");

        // Assert the URL contains only order ID and formatted total
        Long orderId = json.path("orderId").asLong();
        assertTrue(decodedUrl.contains("#" + orderId), "URL must contain order ID");
        assertTrue(decodedUrl.contains("799,80"), "URL must contain formatted total");
    }

    // ── 2. Missing WhatsApp number fails safely ────────────────────────────────

    @Test
    void missingWhatsappNumberFailsGracefullyWithoutReservingStock() throws Exception {
        storeProperties.setWhatsappNumber(""); // blank out
        MockHttpSession customer = registerCustomer("no-phone-user");
        Product product = product("Tênis Vôlei Pro", new BigDecimal("250.00"), 4);
        String key = UUID.randomUUID().toString();
        long ordersBefore = orders.count();

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 1)))
                .andExpect(status().isServiceUnavailable());

        assertEquals(ordersBefore, orders.count(), "No order should be created");
        assertEquals(4, products.findById(product.getId()).orElseThrow().getStockQuantity(), "Stock must not change");
    }

    // ── 3. Invalid WhatsApp number format fails safely ─────────────────────────

    @Test
    void invalidWhatsappNumberFormatFailsGracefully() throws Exception {
        storeProperties.setWhatsappNumber("+55 (35) 99152-6318"); // contains symbols
        MockHttpSession customer = registerCustomer("bad-phone-user");
        Product product = product("Tênis Futsal Club", new BigDecimal("180.00"), 3);
        String key = UUID.randomUUID().toString();

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 1)))
                .andExpect(status().isServiceUnavailable());

        assertEquals(3, products.findById(product.getId()).orElseThrow().getStockQuantity(), "Stock must not change");
    }

    // ── 4. Happy path: order created, stock reserved, wa.me URL returned ───────

    @Test
    void successfulCheckoutReservesStockAndReturnsValidWhatsappUrl() throws Exception {
        MockHttpSession customer = registerCustomer("happy-user");
        Product product = product("Tênis Handball Speed", new BigDecimal("299.90"), 10);
        String key = UUID.randomUUID().toString();

        MvcResult result = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 3)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").isNumber())
                .andExpect(jsonPath("$.whatsappUrl").isString())
                .andReturn();

        JsonNode json = json(result);
        long orderId = json.path("orderId").asLong();
        String url = json.path("whatsappUrl").asText();

        assertTrue(url.startsWith("https://wa.me/" + STORE_PHONE));

        // Verify database state
        PurchaseOrder order = orders.findById(orderId).orElseThrow();
        assertEquals(PaymentProvider.WHATSAPP, order.getPaymentProvider());
        assertEquals(PaymentStatus.PENDING_PAYMENT, order.getStatus());
        assertEquals(PaymentState.PENDING, order.getPaymentState());
        assertEquals(InventoryStatus.RESERVED, order.getInventoryStatus());
        assertEquals(new BigDecimal("899.70"), order.getTotal());
        assertEquals(url, order.getWhatsappUrl());
        assertNotNull(order.getWhatsappExpiresAt());

        // Verify stock was reserved
        assertEquals(7, products.findById(product.getId()).orElseThrow().getStockQuantity());
    }

    // ── 5. Idempotent replay: exact same payload returns same result ───────────

    @Test
    void replayWithSameIdempotencyKeyReturnsSameOrderWithoutDoubleReserving() throws Exception {
        MockHttpSession customer = registerCustomer("idempotent-user");
        Product product = product("Tênis Futebol Society", new BigDecimal("220.00"), 5);
        String key = UUID.randomUUID().toString();

        // First call
        MvcResult first = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 2)))
                .andExpect(status().isOk())
                .andReturn();

        long orderId1 = json(first).path("orderId").asLong();
        String url1 = json(first).path("whatsappUrl").asText();

        // Second call (replay)
        MvcResult second = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 2)))
                .andExpect(status().isOk())
                .andReturn();

        long orderId2 = json(second).path("orderId").asLong();
        String url2 = json(second).path("whatsappUrl").asText();

        assertEquals(orderId1, orderId2, "Replay must return the same order ID");
        assertEquals(url1, url2, "Replay must return the exact same URL");

        // Stock must be decremented only once (5 - 2 = 3)
        assertEquals(3, products.findById(product.getId()).orElseThrow().getStockQuantity());
    }

    // ── 6. Conflicting payload with same idempotency key fails with 409 ────────

    @Test
    void conflictingPayloadWithSameKeyReturnsConflict() throws Exception {
        MockHttpSession customer = registerCustomer("conflict-user");
        Product productA = product("Tênis A", new BigDecimal("100.00"), 5);
        Product productB = product("Tênis B", new BigDecimal("200.00"), 5);
        String key = UUID.randomUUID().toString();

        // First call with Product A
        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(productA.getId(), 1)))
                .andExpect(status().isOk());

        // Second call with different payload (Product B) but same key
        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(productB.getId(), 1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_PAYLOAD_MISMATCH"));
    }

    // ── 7. Insufficient stock returns 422 ─────────────────────────────────────

    @Test
    void insufficientStockFailsWithoutCreatingOrder() throws Exception {
        MockHttpSession customer = registerCustomer("no-stock-user");
        Product product = product("Tênis Raro", new BigDecimal("500.00"), 1);
        String key = UUID.randomUUID().toString();
        long ordersBefore = orders.count();

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 5))) // requesting 5 when only 1 available
                .andExpect(status().isUnprocessableEntity());

        assertEquals(ordersBefore, orders.count(), "No order should be created");
        assertEquals(1, products.findById(product.getId()).orElseThrow().getStockQuantity(), "Stock must not change");
    }

    // ── 8. Admin manual payment confirmation marks PAID and COMMITTED ─────────

    @Test
    void adminCanConfirmWhatsappPaymentConsolidatingStock() throws Exception {
        MockHttpSession customer = registerCustomer("confirm-pay-user");
        Product product = product("Tênis Street", new BigDecimal("350.00"), 8);
        String key = UUID.randomUUID().toString();

        MvcResult checkout = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 2)))
                .andExpect(status().isOk())
                .andReturn();

        long orderId = json(checkout).path("orderId").asLong();
        String adminToken = loginAdmin();

        // Confirm payment via admin endpoint
        mockMvc.perform(post("/api/admin/orders/" + orderId + "/confirm-whatsapp-payment")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.paymentVerified").value(true));

        PurchaseOrder updated = orders.findById(orderId).orElseThrow();
        assertEquals(PaymentStatus.PAID, updated.getStatus());
        assertEquals(PaymentState.SUCCEEDED, updated.getPaymentState());
        assertEquals(InventoryStatus.COMMITTED, updated.getInventoryStatus());
        assertEquals(new BigDecimal("700.00"), updated.getCapturedAmount());
        assertNotNull(updated.getPaidAt());
    }

    // ── 9. Admin order cancellation marks CANCELED and releases inventory ─────

    @Test
    void adminCanCancelWhatsappOrderReleasingInventory() throws Exception {
        MockHttpSession customer = registerCustomer("cancel-user");
        Product product = product("Tênis Treino", new BigDecimal("150.00"), 6);
        String key = UUID.randomUUID().toString();

        MvcResult checkout = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 2)))
                .andExpect(status().isOk())
                .andReturn();

        long orderId = json(checkout).path("orderId").asLong();
        assertEquals(4, products.findById(product.getId()).orElseThrow().getStockQuantity()); // 6 - 2 = 4

        String adminToken = loginAdmin();

        // Cancel order via admin endpoint.
        mockMvc.perform(post("/api/admin/orders/" + orderId + "/cancel-whatsapp-order")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAYMENT_CANCELED"));

        PurchaseOrder updated = orders.findById(orderId).orElseThrow();
        assertEquals(PaymentStatus.PAYMENT_CANCELED, updated.getStatus());
        assertEquals(InventoryStatus.RELEASED, updated.getInventoryStatus());

        // The two reserved units were restored exactly.
        assertEquals(6, products.findById(product.getId()).orElseThrow().getStockQuantity());

        // Retrying the same terminal transition is idempotent and cannot restore twice.
        mockMvc.perform(post("/api/admin/orders/" + orderId + "/cancel-whatsapp-order")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAYMENT_CANCELED"));
        assertEquals(6, products.findById(product.getId()).orElseThrow().getStockQuantity());
    }

    // ── 10. Authentication and ownership checks ───────────────────────────────

    @Test
    void anonymousUserCannotCheckoutAndOtherCustomerCannotAccessOrder() throws Exception {
        Product product = product("Tênis Privado", new BigDecimal("200.00"), 5);

        // Anonymous checkout fails
        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 1)))
                .andExpect(status().isUnauthorized());

        // Customer A creates order
        MockHttpSession customerA = registerCustomer("cust-a");
        MvcResult checkout = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customerA)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 1)))
                .andExpect(status().isOk())
                .andReturn();

        long orderId = json(checkout).path("orderId").asLong();

        // Customer B cannot access order of Customer A
        MockHttpSession customerB = registerCustomer("cust-b");
        mockMvc.perform(get("/api/customer/payments/orders/" + orderId + "/status")
                        .session(customerB))
                .andExpect(status().isNotFound());
    }

    // ── 11. Admin endpoints require Bearer authentication ─────────────────────

    @Test
    void adminEndpointsRejectUnauthorizedRequests() throws Exception {
        mockMvc.perform(post("/api/admin/orders/1/confirm-whatsapp-payment"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/admin/orders/1/cancel-whatsapp-order"))
                .andExpect(status().isForbidden());
    }

    // ── 12. Order expiry scheduled cleanup ────────────────────────────────────

    @Test
    void expiredWhatsappOrdersAreCancelledAndInventoryReleased() throws Exception {
        MockHttpSession customer = registerCustomer("expire-user");
        Product product = product("Tênis Expira", new BigDecimal("120.00"), 5);
        String key = UUID.randomUUID().toString();

        MvcResult checkout = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf())
                        .session(customer)
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(checkoutBody(product.getId(), 2)))
                .andExpect(status().isOk())
                .andReturn();

        long orderId = json(checkout).path("orderId").asLong();
        PurchaseOrder order = orders.findById(orderId).orElseThrow();
        assertEquals(3, products.findById(product.getId()).orElseThrow().getStockQuantity());

        // Force expiry timestamp into the past (2 hours ago)
        order.setupWhatsappOrder(order.getWhatsappUrl(), Instant.now().minus(2, ChronoUnit.HOURS));
        orders.saveAndFlush(order);

        // Run the expiry job
        whatsappCheckoutService.expireStaleWhatsappOrders();

        PurchaseOrder expired = orders.findById(orderId).orElseThrow();
        assertEquals(PaymentStatus.PAYMENT_CANCELED, expired.getStatus());
        assertEquals(InventoryStatus.RELEASED, expired.getInventoryStatus());
        assertEquals(5, products.findById(product.getId()).orElseThrow().getStockQuantity());

        // A repeated scheduler pass cannot restore the same reservation twice.
        whatsappCheckoutService.expireStaleWhatsappOrders();
        assertEquals(5, products.findById(product.getId()).orElseThrow().getStockQuantity());
    }

    // ── Test helpers ──────────────────────────────────────────────────────────

    private MockHttpSession registerCustomer(String prefix) throws Exception {
        String username = prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
        MockHttpSession session = new MockHttpSession();
        mockMvc.perform(post("/api/customer/auth/register")
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"SenhaForte123\"}"))
                .andExpect(status().isCreated());
        return session;
    }

    private Product product(String name, BigDecimal price, int stock) {
        Product product = new Product(null, name, "Basquete", price,
                "https://example.test/shoe.png", "Tênis esportivo");
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

    private static String checkoutBody(Long productId, int quantity) {
        return "{\"fullName\":\"Cliente WhatsApp\",\"email\":\"cliente.wa@example.test\","
                + "\"cpf\":\"529.982.247-25\",\"postalCode\":\"01001-000\",\"state\":\"SP\","
                + "\"city\":\"Sao Paulo\",\"neighborhood\":\"Centro\",\"street\":\"Rua Teste\","
                + "\"addressNumber\":\"100\",\"items\":[{\"productId\":" + productId + ",\"quantity\":" + quantity + "}]}";
    }

    private static JsonNode json(MvcResult result) throws Exception {
        return JsonMapper.shared().readTree(result.getResponse().getContentAsString());
    }
}
