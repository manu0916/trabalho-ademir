package com.ecommerce.hardware;

import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.security.StripeWebhookBodyLimitFilter;
import com.ecommerce.hardware.service.StripePaymentGateway;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$vADAsIj89J6CC52LDMhGsOyh0TOFIkjGJtUFgmkZQ6SddtSMSo0Wy",
        "app.stripe.reconciliation-interval-ms=86400000"
})
@AutoConfigureMockMvc
class HardwareApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProductRepository productRepository;

    @MockitoBean
    private StripePaymentGateway stripePaymentGateway;

    @Test
    void contextLoads() {
    }

    @Test
    void stripeWebhookBodyLimitPreservesExactBytesForSignatureVerification() throws Exception {
        String signature = "t=1786406400,v1=test-signature";
        byte[] rawPayload = "{\r\n  \"id\": \"evt_a\u00e7\u00e3o\", \"spaces\": \"  \"\r\n}\n"
                .getBytes(StandardCharsets.UTF_8);
        when(stripePaymentGateway.verifyWebhook(anyString(), eq(signature)))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST, "test stop"));

        mockMvc.perform(post("/api/payments/stripe/webhook")
                        .header("Stripe-Signature", signature)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(rawPayload))
                .andExpect(status().isBadRequest());

        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(stripePaymentGateway).verifyWebhook(payload.capture(), eq(signature));
        assertArrayEquals(rawPayload, payload.getValue().getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void stripeWebhookRejectsDeclaredOversizeBodyBeforeSignatureVerification() throws Exception {
        byte[] oversized = new byte[StripeWebhookBodyLimitFilter.MAX_WEBHOOK_BYTES + 1];

        mockMvc.perform(post("/api/payments/stripe/webhook")
                        .header("Stripe-Signature", "unused")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(oversized))
                .andExpect(status().isPayloadTooLarge());

        verify(stripePaymentGateway, never()).verifyWebhook(anyString(), anyString());
    }

    @Test
    void stripeWebhookRejectsUnknownLengthAfterOnlyLimitPlusOneBytesAndMatchesExactPath() throws Exception {
        StripeWebhookBodyLimitFilter filter = new StripeWebhookBodyLimitFilter();
        UnknownLengthRequest oversized = new UnknownLengthRequest(
                "/api/payments/stripe/webhook", StripeWebhookBodyLimitFilter.MAX_WEBHOOK_BYTES + 128);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean invoked = new AtomicBoolean();

        filter.doFilter(oversized, response, (request, result) -> invoked.set(true));

        assertEquals(413, response.getStatus());
        assertFalse(invoked.get());
        assertEquals(StripeWebhookBodyLimitFilter.MAX_WEBHOOK_BYTES + 1, oversized.bytesRead());

        UnknownLengthRequest nearMiss = new UnknownLengthRequest(
                "/api/payments/stripe/webhook/replay", StripeWebhookBodyLimitFilter.MAX_WEBHOOK_BYTES + 128);
        AtomicBoolean nearMissInvoked = new AtomicBoolean();
        filter.doFilter(nearMiss, new MockHttpServletResponse(),
                (request, result) -> nearMissInvoked.set(true));
        assertTrue(nearMissInvoked.get());
        assertEquals(0, nearMiss.bytesRead());
    }

    @Test
    void publicProductsRemainReadableWithSecurityHeaders() throws Exception {
        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Nexus-Backend-Commit", "local"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Security-Policy",
                        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"));
    }

    @Test
    void productCreationIsDeniedWithoutASignedAdministratorToken() throws Exception {
        mockMvc.perform(post("/api/products")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"GPU\",\"category\":\"GPU\",\"price\":100,"
                        + "\"stockQuantity\":1,\"imageUrl\":\"https://example.com/gpu.png\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void vercelPreviewDeploymentsCanReachTheApi() throws Exception {
        String previewOrigin = "https://trabalho-ademir-dur49mh1w-manu0916s-projects.vercel.app";

        mockMvc.perform(options("/api/products")
                        .header("Origin", previewOrigin)
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", previewOrigin));
    }

    @Test
    void authenticatedAdminCanCreateAProduct() throws Exception {
        MvcResult loginResult = mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String accessToken = JsonMapper.shared().readTree(loginResult.getResponse().getContentAsString())
                .path("accessToken").asText();
        mockMvc.perform(post("/api/products")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Produto administrativo\",\"category\":\"Teste\",\"price\":10,"
                                + "\"stockQuantity\":1,\"imageUrl\":\"https://example.com/product.png\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Produto administrativo"));
    }

    @Test
    void authenticatedAdminCanCreateAProductWhenSessionCookieAndBearerAreBothPresent() throws Exception {
        MockHttpSession session = new MockHttpSession();
        MvcResult loginResult = mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String accessToken = JsonMapper.shared().readTree(loginResult.getResponse().getContentAsString())
                .path("accessToken").asText();
        mockMvc.perform(post("/api/products")
                        .session(session)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Produto com sessao e bearer\",\"category\":\"Teste\",\"price\":10,"
                                + "\"stockQuantity\":1,\"imageUrl\":\"https://example.com/session-bearer.png\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Produto com sessao e bearer"));
    }

    @Test
    void authenticatedAdminCanUpdateProductStock() throws Exception {
        Product product = productRepository.save(new Product(null, "Estoque", "Teste", new BigDecimal("10.00"),
                "https://example.com/stock.png", "Produto de estoque"));
        MvcResult loginResult = mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String accessToken = JsonMapper.shared().readTree(loginResult.getResponse().getContentAsString())
                .path("accessToken").asText();
        mockMvc.perform(patch("/api/products/{id}/stock", product.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"stockQuantity\":7}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stockQuantity").value(7));
    }

    @Test
    void productCreationDoesNotAcceptATokenOnlyFromTheJsonBody() throws Exception {
        MvcResult loginResult = mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String accessToken = JsonMapper.shared().readTree(loginResult.getResponse().getContentAsString())
                .path("accessToken").asText();
        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Produto pelo corpo\",\"category\":\"Teste\",\"price\":10,"
                                + "\"stockQuantity\":1,\"imageUrl\":\"https://example.com/body.png\","
                                + "\"adminAccessToken\":\"" + accessToken + "\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void cookieSessionAloneCannotWriteProducts() throws Exception {
        MockHttpSession session = new MockHttpSession();
        mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/products")
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Produto sem bearer\",\"category\":\"Teste\",\"price\":10,"
                                + "\"stockQuantity\":1,\"imageUrl\":\"https://example.com/session.png\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void anonymousSessionChecksAreQuiet() throws Exception {
        mockMvc.perform(get("/api/admin/auth/session"))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/customer/auth/session"))
                .andExpect(status().isNoContent());
    }

    @Test
    void bearerAloneCannotRefreshAdminTokenButPersistedSessionCan() throws Exception {
        MockHttpSession adminSession = new MockHttpSession();
        MvcResult loginResult = mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String bearer = JsonMapper.shared().readTree(loginResult.getResponse().getContentAsString())
                .path("accessToken").asText();

        mockMvc.perform(get("/api/admin/auth/session")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearer))
                .andExpect(status().isNoContent());
        MvcResult matrixParameterAttempt = mockMvc.perform(get("/api/admin/auth/session;source=bearer")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearer))
                .andExpect(status().is4xxClientError())
                .andReturn();
        assertNull(matrixParameterAttempt.getHandler());

        MvcResult refreshed = mockMvc.perform(get("/api/admin/auth/session")
                        .session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@example.test"))
                .andReturn();
        assertFalse(JsonMapper.shared().readTree(refreshed.getResponse().getContentAsString())
                .path("accessToken").asText().isBlank());
    }

    @Test
    void healthEndpointIdentifiesTheRunningBuild() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.commit").value("local"));
    }

    @Test
    void refreshedAdminSessionIssuesATokenThatCanCreateAProduct() throws Exception {
        MockHttpSession session = new MockHttpSession();

        mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk());

        MvcResult refreshedSession = mockMvc.perform(get("/api/admin/auth/session")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@example.test"))
                .andReturn();

        String accessToken = JsonMapper.shared().readTree(refreshedSession.getResponse().getContentAsString())
                .path("accessToken").asText();
        assertFalse(accessToken.isBlank());

        mockMvc.perform(post("/api/products")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Produto apos refresh\",\"category\":\"Teste\",\"price\":10,"
                                + "\"stockQuantity\":1,\"imageUrl\":\"https://example.com/refreshed.png\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Produto apos refresh"));
    }

    @Test
    void legacyOrderCreationEndpointIsMethodNotAllowed() throws Exception {
        MockHttpSession session = new MockHttpSession();

        mockMvc.perform(post("/api/customer/auth/register")
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"cliente.teste\",\"password\":\"senha123\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("cliente.teste"));

        mockMvc.perform(post("/api/customer/orders")
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void refundRouteWithMatrixParametersStillRequiresAdministratorBearer() throws Exception {
        MockHttpSession session = new MockHttpSession();
        mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .session(session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk());

        MvcResult valuedParameter = mockMvc.perform(
                        post("/api/admin/orders/999999/refund;x=1").session(session))
                .andExpect(status().is4xxClientError())
                .andReturn();
        MvcResult flagParameter = mockMvc.perform(
                        post("/api/admin/orders/999999/refund;foo").session(session))
                .andExpect(status().is4xxClientError())
                .andReturn();
        assertNull(valuedParameter.getHandler());
        assertNull(flagParameter.getHandler());
    }

    private static final class UnknownLengthRequest extends MockHttpServletRequest {
        private final GeneratedServletInputStream input;

        private UnknownLengthRequest(String requestUri, int bodyLength) {
            setMethod("POST");
            setRequestURI(requestUri);
            this.input = new GeneratedServletInputStream(bodyLength);
        }

        @Override
        public int getContentLength() {
            return -1;
        }

        @Override
        public long getContentLengthLong() {
            return -1;
        }

        @Override
        public ServletInputStream getInputStream() {
            return input;
        }

        private int bytesRead() {
            return input.position;
        }
    }

    private static final class GeneratedServletInputStream extends ServletInputStream {
        private final int length;
        private int position;

        private GeneratedServletInputStream(int length) {
            this.length = length;
        }

        @Override
        public int read() {
            if (position >= length) return -1;
            position++;
            return 'x';
        }

        @Override
        public int read(byte[] bytes, int offset, int requested) {
            if (position >= length) return -1;
            int count = Math.min(requested, length - position);
            Arrays.fill(bytes, offset, offset + count, (byte) 'x');
            position += count;
            return count;
        }

        @Override
        public boolean isFinished() {
            return position >= length;
        }

        @Override
        public boolean isReady() {
            return true;
        }

        @Override
        public void setReadListener(ReadListener listener) {
            throw new UnsupportedOperationException("Synchronous test stream");
        }
    }
}
