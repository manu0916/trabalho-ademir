package com.ecommerce.hardware;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class ApiSecurityPolicyIntegrationTests {

    private static final String PREVIEW_ORIGIN =
            "https://trabalho-ademir-security-manu0916s-projects.vercel.app";

    @Autowired
    private MockMvc mockMvc;

    @Test
    void corsAllowsPutAndStorefrontReadsRemainPublic() throws Exception {
        mockMvc.perform(options("/api/customer/account/profile")
                        .header(HttpHeaders.ORIGIN, PREVIEW_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type,x-xsrf-token"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, PREVIEW_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, containsString("PUT")));

        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/storefront/hero"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/storefront/footer"))
                .andExpect(status().isOk());
    }

    @Test
    void anonymousSupportAndStockSubmissionsDoNotRequireCsrf() throws Exception {
        mockMvc.perform(post("/api/support/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Cliente Teste\",\"email\":\"cliente@example.test\"," +
                                "\"subject\":\"Dúvida\",\"message\":\"Preciso de ajuda com um pedido.\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"));

        mockMvc.perform(post("/api/stock-alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":42,\"productName\":\"Tênis Teste\",\"size\":\"40\"," +
                                "\"color\":\"Preto\",\"email\":\"estoque@example.test\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void couponSupportAndStockMutationsRequireBearerButNotCsrf() throws Exception {
        String anonymousCode = "ANON" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        mockMvc.perform(post("/api/admin/coupons")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(couponBody(anonymousCode)))
                .andExpect(status().isUnauthorized());

        MockHttpSession adminSession = new MockHttpSession();
        MvcResult login = mockMvc.perform(post("/api/admin/auth/login")
                        .with(csrf())
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String bearer = json(login).path("accessToken").asText();

        String sessionOnlyCode = "SESSION" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        mockMvc.perform(post("/api/admin/coupons")
                        .with(csrf())
                        .session(adminSession)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(couponBody(sessionOnlyCode)))
                .andExpect(status().isForbidden());

        String couponCode = "BEARER" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        MvcResult coupon = mockMvc.perform(post("/api/admin/coupons")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(couponBody(couponCode)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(couponCode.toUpperCase()))
                .andReturn();
        long couponId = json(coupon).path("id").asLong();

        mockMvc.perform(patch("/api/admin/coupons/{id}/toggle", couponId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        MvcResult support = mockMvc.perform(post("/api/support/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Cliente SAC\",\"email\":\"sac@example.test\"," +
                                "\"subject\":\"Status\",\"message\":\"Mensagem para atualizar.\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        long supportId = json(support).path("id").asLong();
        mockMvc.perform(patch("/api/admin/support/messages/{id}/status", supportId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ANSWERED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ANSWERED"));

        MvcResult alert = mockMvc.perform(post("/api/stock-alerts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":84,\"productName\":\"Tênis Alerta\",\"size\":\"41\"," +
                                "\"color\":\"Azul\",\"email\":\"alerta@example.test\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        long alertId = json(alert).path("id").asLong();
        mockMvc.perform(patch("/api/admin/stock-alerts/{id}/notify", alertId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOTIFIED"));

        mockMvc.perform(delete("/api/admin/coupons/{id}", couponId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearer))
                .andExpect(status().isNoContent());
    }

    private static String couponBody(String code) {
        return "{\"code\":\"" + code + "\",\"discountPercent\":10,\"minOrderValue\":0}";
    }

    private static JsonNode json(MvcResult result) throws Exception {
        return JsonMapper.shared().readTree(result.getResponse().getContentAsString());
    }
}
