package com.ecommerce.hardware;

import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.repository.ProductRepository;
import jakarta.servlet.http.HttpSession;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.junit.jupiter.api.Assertions.assertFalse;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$vADAsIj89J6CC52LDMhGsOyh0TOFIkjGJtUFgmkZQ6SddtSMSo0Wy"
})
@AutoConfigureMockMvc
class HardwareApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProductRepository productRepository;

    @Test
    void contextLoads() {
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
                .andExpect(status().isUnauthorized());
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
                .andExpect(status().isUnauthorized());
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
    void customerCanRegisterAndCreateOrderWithValidCpf() throws Exception {
        Product product = productRepository.save(new Product(null, "SSD 1TB", "SSD", new BigDecimal("499.90"),
                "https://example.com/ssd.png", "SSD de teste"));
        HttpSession session = new MockHttpSession();

        mockMvc.perform(post("/api/customer/auth/register")
                        .with(csrf())
                        .session((MockHttpSession) session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"cliente.teste\",\"password\":\"senha123\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("cliente.teste"));

        mockMvc.perform(post("/api/customer/orders")
                        .with(csrf())
                        .session((MockHttpSession) session)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Cliente de Teste\",\"email\":\"cliente@example.test\","
                                + "\"cpf\":\"529.982.247-25\",\"paymentMethod\":\"PIX\","
                                + "\"postalCode\":\"01001-000\",\"state\":\"SP\",\"city\":\"São Paulo\","
                                + "\"neighborhood\":\"Sé\",\"street\":\"Praça da Sé\",\"addressNumber\":\"100\","
                                + "\"items\":[{\"productId\":" + product.getId() + ",\"quantity\":2}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(999.80))
                .andExpect(jsonPath("$.items[0].productName").value("SSD 1TB"));
    }
}
