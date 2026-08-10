package com.ecommerce.hardware;

import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.repository.ProductRepository;
import jakarta.servlet.http.HttpSession;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
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
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Security-Policy",
                        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"));
    }

    @Test
    void productCreationIsDeniedWithoutAnAuthenticatedAdminSession() throws Exception {
        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"GPU\",\"category\":\"GPU\",\"price\":100,\"imageUrl\":\"https://example.com/gpu.png\"}"))
                .andExpect(status().isForbidden());
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
