package com.ecommerce.hardware;

import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.model.PurchaseOrder;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import com.ecommerce.hardware.service.StripePaymentGateway;
import com.ecommerce.hardware.service.StripePaymentGateway.CheckoutConfiguration;
import com.ecommerce.hardware.service.StripePaymentGateway.CheckoutSession;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$vADAsIj89J6CC52LDMhGsOyh0TOFIkjGJtUFgmkZQ6SddtSMSo0Wy",
        "app.security.api-rate-limit-per-minute=1000",
        "app.stripe.reconciliation-interval-ms=86400000"
})
@AutoConfigureMockMvc
class CustomerAccountIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CustomerAccountRepository accounts;

    @Autowired
    private ProductRepository products;

    @Autowired
    private PurchaseOrderRepository orders;

    @Autowired
    private JdbcTemplate jdbc;

    @MockitoBean
    private StripePaymentGateway stripe;

    @Test
    void profileIsPrivateMaskedAndCpfCanBePreservedDuringEditing() throws Exception {
        mockMvc.perform(get("/api/customer/account"))
                .andExpect(status().isUnauthorized());

        MockHttpSession customer = registerCustomer("profile");
        mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("no-store")))
                .andExpect(jsonPath("$.profile").doesNotExist())
                .andExpect(jsonPath("$.addresses").isEmpty());

        mockMvc.perform(put("/api/customer/account/profile")
                        .with(csrf()).session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(profileBody("Cliente da Silva", "CLIENTE@EXAMPLE.TEST", "529.982.247-25")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Cliente da Silva"))
                .andExpect(jsonPath("$.email").value("cliente@example.test"))
                .andExpect(jsonPath("$.cpfMasked").value("***.***.***-25"))
                .andExpect(jsonPath("$.hasCpf").value(true))
                .andExpect(jsonPath("$.cpf").doesNotExist());

        mockMvc.perform(put("/api/customer/account/profile")
                        .with(csrf()).session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(profileBody("Cliente Atualizado", "novo@example.test", "")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpfMasked").value("***.***.***-25"));

        Long customerId = (Long) customer.getAttribute("customerId");
        assertEquals("52998224725", accounts.findById(customerId).orElseThrow().getCpf());
    }

    @Test
    void profileRequiresCsrfAndCpfOnFirstSave() throws Exception {
        MockHttpSession customer = registerCustomer("csrf-profile");
        String body = profileBody("Cliente da Silva", "cliente@example.test", "52998224725");

        mockMvc.perform(put("/api/customer/account/profile")
                        .session(customer).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/customer/account/profile")
                        .with(csrf()).session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(profileBody("Cliente da Silva", "cliente@example.test", "")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void addressesCanBeCreatedEditedSelectedAsDefaultAndDeleted() throws Exception {
        MockHttpSession customer = registerCustomer("addresses");

        long homeId = createAddress(customer, "Casa", "100", false);
        mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.addresses[0].id").value(homeId))
                .andExpect(jsonPath("$.addresses[0].isDefault").value(true));

        long workId = createAddress(customer, "Trabalho", "200", false);
        mockMvc.perform(put("/api/customer/account/addresses/{id}", workId)
                        .with(csrf()).session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(addressBody("Escritório", "200", true)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Escritório"))
                .andExpect(jsonPath("$.isDefault").value(true));

        mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.addresses[0].id").value(workId))
                .andExpect(jsonPath("$.addresses[1].isDefault").value(false));

        mockMvc.perform(delete("/api/customer/account/addresses/{id}", workId)
                        .with(csrf()).session(customer))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.addresses[0].id").value(homeId))
                .andExpect(jsonPath("$.addresses[0].isDefault").value(true));
    }

    @Test
    void oneCustomerCannotReadEditDeleteOrCheckoutWithAnotherCustomersAddress() throws Exception {
        MockHttpSession owner = registerCustomer("address-owner");
        MockHttpSession attacker = registerCustomer("address-other");
        long addressId = createAddress(owner, "Casa", "10", true);

        mockMvc.perform(get("/api/customer/account").session(attacker))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.addresses").isEmpty());
        mockMvc.perform(put("/api/customer/account/addresses/{id}", addressId)
                        .with(csrf()).session(attacker).contentType(MediaType.APPLICATION_JSON)
                        .content(addressBody("Tentativa", "20", true)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/customer/account/addresses/{id}", addressId)
                        .with(csrf()).session(attacker))
                .andExpect(status().isNotFound());

        saveProfile(attacker);
        Product product = product("Ownership", 2);
        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(attacker)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(savedCheckoutBody(product.getId(), addressId)))
                .andExpect(status().isNotFound());
        verify(stripe, never()).createCheckout(any(), anyList(), anyString());
    }

    @Test
    void checkoutUsesServerSideProfileAndOwnedAddressSnapshotIncludingComplement() throws Exception {
        MockHttpSession customer = registerCustomer("saved-checkout");
        saveProfile(customer);
        long addressId = createAddress(customer, "Casa", "321", true);
        Product product = product("Checkout salvo", 3);
        String checkoutSessionId = stripeId("cs_test_");
        String checkoutUrl = "https://checkout.stripe.test/" + checkoutSessionId;
        stubHostedCheckout(checkoutSessionId, checkoutUrl);

        MvcResult result = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(savedCheckoutBody(product.getId(), addressId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkoutUrl").value(checkoutUrl))
                .andReturn();

        PurchaseOrder order = orders.findById(json(result).path("orderId").asLong()).orElseThrow();
        assertEquals("Cliente da Silva", order.getFullName());
        assertEquals("cliente@example.test", order.getEmail());
        assertEquals("52998224725", order.getCpf());
        assertEquals("321", order.getAddressNumber());
        assertEquals("Apto 12", order.getComplement());
        assertEquals(2, products.findById(product.getId()).orElseThrow().getStockQuantity());

        mockMvc.perform(get("/api/customer/orders").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].cpf").value("***.***.***-25"))
                .andExpect(jsonPath("$[0].cpf").value(org.hamcrest.Matchers.not("52998224725")));
    }

    @Test
    void firstCheckoutCanSaveProfileAndNewAddressWithoutCreatingDuplicatesOnRetry() throws Exception {
        MockHttpSession customer = registerCustomer("first-checkout");
        Product product = product("Primeira compra", 3);
        String key = UUID.randomUUID().toString();
        String checkoutSessionId = stripeId("cs_test_");
        String checkoutUrl = "https://checkout.stripe.test/" + checkoutSessionId;
        stubHostedCheckout(checkoutSessionId, checkoutUrl);
        String body = newCheckoutAndSaveBody(product.getId());

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

        MvcResult account = mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.cpfMasked").value("***.***.***-25"))
                .andExpect(jsonPath("$.addresses.length()").value(1))
                .andReturn();
        assertTrue(json(account).path("addresses").get(0).path("isDefault").asBoolean());
        verify(stripe, times(1)).createCheckout(any(PurchaseOrder.class), anyList(), anyString());
    }

    @Test
    void replayAfterReloadCanUseNewlySavedProfileAndAddressWithoutASecondOrder() throws Exception {
        MockHttpSession customer = registerCustomer("reload-replay");
        Product product = product("Replay após recarregar", 3);
        String key = UUID.randomUUID().toString();
        String checkoutUrl = "https://checkout.stripe.test/reload";
        stubHostedCheckout(stripeId("cs_test_"), checkoutUrl);

        MvcResult first = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(newCheckoutAndSaveBody(product.getId())))
                .andExpect(status().isOk())
                .andReturn();
        long orderId = json(first).path("orderId").asLong();
        MvcResult account = mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.addresses.length()").value(1))
                .andReturn();
        long addressId = json(account).path("addresses").get(0).path("id").asLong();

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(savedCheckoutBody(product.getId(), addressId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").value(orderId))
                .andExpect(jsonPath("$.checkoutUrl").value(checkoutUrl));

        mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.addresses.length()").value(1));
        assertEquals(2, products.findById(product.getId()).orElseThrow().getStockQuantity());
        verify(stripe, times(1)).createCheckout(any(PurchaseOrder.class), anyList(), anyString());
    }

    @Test
    void attachedLegacyAttemptCanReplayButNeverRunsNewPersistenceIntent() throws Exception {
        MockHttpSession customer = registerCustomer("legacy-replay");
        Product product = product("Replay legado", 3);
        String key = UUID.randomUUID().toString();
        String checkoutUrl = "https://checkout.stripe.test/legacy";
        stubHostedCheckout(stripeId("cs_test_"), checkoutUrl);
        String withoutSaves = newCheckoutAndSaveBody(product.getId())
                .replace("\"saveProfile\":true", "\"saveProfile\":false")
                .replace("\"saveAddress\":true", "\"saveAddress\":false")
                .replace("\"makeDefaultAddress\":true", "\"makeDefaultAddress\":false");

        MvcResult first = mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(withoutSaves))
                .andExpect(status().isOk())
                .andReturn();
        long orderId = json(first).path("orderId").asLong();
        String legacyHash = legacyCheckoutHash(product.getId(), 1);
        assertEquals(1, jdbc.update("update payment_checkout_attempts set request_hash = ? "
                + "where idempotency_key = ?", legacyHash, key));
        assertEquals(1, jdbc.update("update purchase_orders set checkout_request_hash = ? where id = ?",
                legacyHash, orderId));

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(newCheckoutAndSaveBody(product.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderId").value(orderId))
                .andExpect(jsonPath("$.checkoutUrl").value(checkoutUrl));

        mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile").doesNotExist())
                .andExpect(jsonPath("$.addresses").isEmpty());
        assertEquals(2, products.findById(product.getId()).orElseThrow().getStockQuantity());
        verify(stripe, times(1)).createCheckout(any(PurchaseOrder.class), anyList(), anyString());
    }

    @Test
    void reusedKeyWithConflictingPayloadCannotMutateProfileAddressesOrDefault() throws Exception {
        MockHttpSession customer = registerCustomer("conflict-no-mutation");
        saveProfile(customer);
        long homeId = createAddress(customer, "Casa", "10", true);
        long workId = createAddress(customer, "Trabalho", "20", false);
        Product product = product("Conflito sem escrita", 3);
        String key = UUID.randomUUID().toString();
        stubHostedCheckout(stripeId("cs_test_"), "https://checkout.stripe.test/original");

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(savedCheckoutBody(product.getId(), homeId)))
                .andExpect(status().isOk());

        String conflicting = newCheckoutAndSaveBody(product.getId())
                .replace("Cliente da Silva", "Cliente Modificado")
                .replace("cliente@example.test", "modificado@example.test")
                .replace("52998224725", "11144477735")
                .replace("\"addressLabel\":\"Casa\"", "\"addressLabel\":\"Endereço invasor\"")
                .replace("\"street\":\"Rua Um\"", "\"street\":\"Rua Modificada\"")
                .replace("\"addressNumber\":\"15\"", "\"addressNumber\":\"999\"");
        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(conflicting))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_PAYLOAD_MISMATCH"));

        mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.fullName").value("Cliente da Silva"))
                .andExpect(jsonPath("$.profile.email").value("cliente@example.test"))
                .andExpect(jsonPath("$.profile.cpfMasked").value("***.***.***-25"))
                .andExpect(jsonPath("$.addresses.length()").value(2))
                .andExpect(jsonPath("$.addresses[0].id").value(homeId))
                .andExpect(jsonPath("$.addresses[0].isDefault").value(true))
                .andExpect(jsonPath("$.addresses[1].id").value(workId));
        verify(stripe, times(1)).createCheckout(any(PurchaseOrder.class), anyList(), anyString());
    }

    @Test
    void reusedKeyWithSameSnapshotButDifferentPersistenceFlagsConflictsWithoutSaving() throws Exception {
        MockHttpSession customer = registerCustomer("flags-no-mutation");
        Product product = product("Flags na idempotência", 3);
        String key = UUID.randomUUID().toString();
        stubHostedCheckout(stripeId("cs_test_"), "https://checkout.stripe.test/flags");
        String withoutSaves = newCheckoutAndSaveBody(product.getId())
                .replace("\"saveProfile\":true", "\"saveProfile\":false")
                .replace("\"saveAddress\":true", "\"saveAddress\":false")
                .replace("\"makeDefaultAddress\":true", "\"makeDefaultAddress\":false");

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(withoutSaves))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer).header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON).content(newCheckoutAndSaveBody(product.getId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_PAYLOAD_MISMATCH"));

        mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile").doesNotExist())
                .andExpect(jsonPath("$.addresses").isEmpty());
        verify(stripe, times(1)).createCheckout(any(PurchaseOrder.class), anyList(), anyString());
    }

    @Test
    void cpfAndPostalCodeRejectLettersInsteadOfSilentlyRemovingThem() throws Exception {
        MockHttpSession customer = registerCustomer("strict-digits");

        mockMvc.perform(put("/api/customer/account/profile")
                        .with(csrf()).session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(profileBody("Cliente da Silva", "cliente@example.test", "529A982.247-25")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/customer/account/addresses")
                        .with(csrf()).session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(addressBody("Casa", "10", true).replace("01001-000", "0100A-1000")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/customer/account").session(customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile").doesNotExist())
                .andExpect(jsonPath("$.addresses").isEmpty());
    }

    @Test
    void checkoutRejectsMixingSavedAndNewAddress() throws Exception {
        MockHttpSession customer = registerCustomer("xor-address");
        saveProfile(customer);
        long addressId = createAddress(customer, "Casa", "8", true);
        Product product = product("XOR", 1);
        String body = savedCheckoutBody(product.getId(), addressId).replace(
                "\"items\"", "\"postalCode\":\"01001000\",\"state\":\"SP\","
                        + "\"city\":\"São Paulo\",\"neighborhood\":\"Centro\","
                        + "\"street\":\"Rua Outra\",\"addressNumber\":\"1\",\"items\"");

        mockMvc.perform(post("/api/customer/payments/checkout")
                        .with(csrf()).session(customer)
                        .header("Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
    }

    private MockHttpSession registerCustomer(String prefix) throws Exception {
        MockHttpSession session = new MockHttpSession();
        String username = prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
        mockMvc.perform(post("/api/customer/auth/register")
                        .with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"senha123\"}"))
                .andExpect(status().isCreated());
        return session;
    }

    private void saveProfile(MockHttpSession customer) throws Exception {
        mockMvc.perform(put("/api/customer/account/profile")
                        .with(csrf()).session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(profileBody("Cliente da Silva", "cliente@example.test", "52998224725")))
                .andExpect(status().isOk());
    }

    private long createAddress(MockHttpSession customer, String label, String number, boolean isDefault)
            throws Exception {
        MvcResult result = mockMvc.perform(post("/api/customer/account/addresses")
                        .with(csrf()).session(customer).contentType(MediaType.APPLICATION_JSON)
                        .content(addressBody(label, number, isDefault)))
                .andExpect(status().isCreated())
                .andReturn();
        return json(result).path("id").asLong();
    }

    private Product product(String name, int stock) {
        Product product = new Product(null, name, "Basquete", new BigDecimal("25.00"),
                "https://example.test/shoe.png", "Tênis de teste");
        product.setStockQuantity(stock);
        return products.saveAndFlush(product);
    }

    private void stubHostedCheckout(String sessionId, String checkoutUrl) {
        when(stripe.checkoutConfiguration(anyLong())).thenReturn(new CheckoutConfiguration(
                Instant.now().plusSeconds(3_600),
                "https://store.example.test/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}",
                "https://store.example.test/pagamento/cancelado", 1_800L, 1L));
        when(stripe.createCheckout(any(PurchaseOrder.class), anyList(), anyString()))
                .thenReturn(new CheckoutSession(sessionId, checkoutUrl, null));
    }

    private static String profileBody(String fullName, String email, String cpf) {
        return "{\"fullName\":\"" + fullName + "\",\"email\":\"" + email
                + "\",\"cpf\":\"" + cpf + "\"}";
    }

    private static String addressBody(String label, String number, boolean isDefault) {
        return "{\"label\":\"" + label + "\",\"postalCode\":\"01001-000\","
                + "\"state\":\"sp\",\"city\":\"São Paulo\",\"neighborhood\":\"Centro\","
                + "\"street\":\"Rua de Teste\",\"addressNumber\":\"" + number + "\","
                + "\"complement\":\"Apto 12\",\"isDefault\":" + isDefault + "}";
    }

    private static String savedCheckoutBody(Long productId, long addressId) {
        return "{\"personalDataMode\":\"SAVED\",\"paymentMethod\":\"CARTAO_CREDITO\","
                + "\"addressId\":" + addressId + ",\"items\":[{\"productId\":" + productId
                + ",\"quantity\":1}]}";
    }

    private static String newCheckoutAndSaveBody(Long productId) {
        return "{\"personalDataMode\":\"NEW\",\"fullName\":\"Cliente da Silva\","
                + "\"email\":\"cliente@example.test\",\"cpf\":\"52998224725\","
                + "\"saveProfile\":true,\"paymentMethod\":\"CARTAO_CREDITO\","
                + "\"addressLabel\":\"Casa\",\"postalCode\":\"01001000\",\"state\":\"SP\","
                + "\"city\":\"São Paulo\",\"neighborhood\":\"Centro\",\"street\":\"Rua Um\","
                + "\"addressNumber\":\"15\",\"complement\":\"Fundos\",\"saveAddress\":true,"
                + "\"makeDefaultAddress\":true,\"items\":[{\"productId\":" + productId
                + ",\"quantity\":1}]}";
    }

    private static JsonNode json(MvcResult result) throws Exception {
        return JsonMapper.shared().readTree(result.getResponse().getContentAsString());
    }

    private static String legacyCheckoutHash(Long productId, int quantity) throws Exception {
        StringBuilder canonical = new StringBuilder();
        appendCanonical(canonical, "Cliente da Silva");
        appendCanonical(canonical, "cliente@example.test");
        appendCanonical(canonical, "52998224725");
        appendCanonical(canonical, "CARTAO_CREDITO");
        appendCanonical(canonical, "01001000");
        appendCanonical(canonical, "SP");
        appendCanonical(canonical, "São Paulo");
        appendCanonical(canonical, "Centro");
        appendCanonical(canonical, "Rua Um");
        appendCanonical(canonical, "15");
        appendCanonical(canonical, "Fundos");
        appendCanonical(canonical, productId.toString());
        appendCanonical(canonical, Integer.toString(quantity));
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(canonical.toString().getBytes(StandardCharsets.UTF_8)));
    }

    private static void appendCanonical(StringBuilder target, String value) {
        target.append(value.length()).append(':').append(value).append('|');
    }

    private static String stripeId(String prefix) {
        return prefix + UUID.randomUUID().toString().replace("-", "");
    }
}
