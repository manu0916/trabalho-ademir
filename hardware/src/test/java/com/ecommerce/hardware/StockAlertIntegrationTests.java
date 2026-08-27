package com.ecommerce.hardware;

import com.ecommerce.hardware.model.StockAlert;
import com.ecommerce.hardware.repository.StockAlertRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
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
class StockAlertIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private StockAlertRepository stockAlerts;

    @BeforeEach
    void clearAlerts() {
        stockAlerts.deleteAll();
    }

    @Test
    void emailOnlyAlertAcceptsMissingVariantsAndNormalizesEmail() throws Exception {
        mockMvc.perform(post("/api/stock-alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":42,\"productName\":\"Tênis Teste\"," +
                                "\"email\":\"CLIENTE@EXAMPLE.TEST\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.size").value(""))
                .andExpect(jsonPath("$.color").value(""))
                .andExpect(jsonPath("$.email").value("cliente@example.test"))
                .andExpect(jsonPath("$.whatsapp").doesNotExist())
                .andExpect(jsonPath("$.status").value("PENDING"));

        StockAlert saved = stockAlerts.findAll().getFirst();
        assertEquals("", saved.getSize());
        assertEquals("", saved.getColor());
        assertEquals("cliente@example.test", saved.getEmail());
        assertNull(saved.getWhatsapp());
    }

    @Test
    void whatsappOnlyAlertAcceptsBlankVariantsAndPersistsDigitsOnly() throws Exception {
        mockMvc.perform(post("/api/stock-alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":43,\"productName\":\"Tênis Teste\"," +
                                "\"size\":\"\",\"color\":\"\",\"email\":\"\"," +
                                "\"whatsapp\":\"+55 (11) 99999-0000\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.size").value(""))
                .andExpect(jsonPath("$.color").value(""))
                .andExpect(jsonPath("$.email").value(""))
                .andExpect(jsonPath("$.whatsapp").value("5511999990000"))
                .andExpect(jsonPath("$.status").value("PENDING"));

        StockAlert saved = stockAlerts.findAll().getFirst();
        assertEquals("", saved.getEmail());
        assertEquals("5511999990000", saved.getWhatsapp());
    }

    @Test
    void alertWithoutEmailOrWhatsappIsRejectedWithoutPersistence() throws Exception {
        mockMvc.perform(post("/api/stock-alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":44,\"productName\":\"Tênis Teste\"," +
                                "\"size\":\"\",\"color\":\"\",\"email\":\"\"," +
                                "\"whatsapp\":\"\"}"))
                .andExpect(status().isBadRequest());

        assertEquals(0, stockAlerts.count());
    }

    @Test
    void malformedContactChannelsAreRejectedWithoutPersistence() throws Exception {
        mockMvc.perform(post("/api/stock-alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":45,\"productName\":\"Tênis Teste\"," +
                                "\"email\":\"not-an-email\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/stock-alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":46,\"productName\":\"Tênis Teste\"," +
                                "\"whatsapp\":\"javascript:5511999990000\"}"))
                .andExpect(status().isBadRequest());

        assertEquals(0, stockAlerts.count());
    }
}
