package com.ecommerce.hardware;

import com.ecommerce.hardware.repository.StorefrontFooterSettingsRepository;
import com.ecommerce.hardware.security.AdminAccessTokenService;
import com.ecommerce.hardware.service.StripePaymentGateway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$vADAsIj89J6CC52LDMhGsOyh0TOFIkjGJtUFgmkZQ6SddtSMSo0Wy",
        "app.stripe.reconciliation-interval-ms=86400000"
})
@AutoConfigureMockMvc
class StorefrontFooterIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AdminAccessTokenService accessTokenService;

    @Autowired
    private StorefrontFooterSettingsRepository footerRepository;

    @MockitoBean
    private StripePaymentGateway stripePaymentGateway;

    @BeforeEach
    void resetFooter() {
        footerRepository.deleteAll();
    }

    @Test
    void defaultConfigurationIsPublicAndHasAllConfigurableFields() throws Exception {
        mockMvc.perform(get("/api/storefront/footer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wordmark").value("KICKS STORE"))
                .andExpect(jsonPath("$.brandTagline").value("Calce a felicidade. Viva o seu ritmo."))
                .andExpect(jsonPath("$.locationTitle").value(""))
                .andExpect(jsonPath("$.addressLine1").value(""))
                .andExpect(jsonPath("$.addressLine2").value(""))
                .andExpect(jsonPath("$.hoursTitle").value(""))
                .andExpect(jsonPath("$.storeHoursLine1").value(""))
                .andExpect(jsonPath("$.storeHoursLine2").value(""))
                .andExpect(jsonPath("$.authTitle").value(""))
                .andExpect(jsonPath("$.authBadgeTitle").value(""))
                .andExpect(jsonPath("$.authBadgeDetail").value(""))
                .andExpect(jsonPath("$.navTitle").value(""))
                .andExpect(jsonPath("$.backToTopText").value(""))
                .andExpect(jsonPath("$.contactEmail").value(""))
                .andExpect(jsonPath("$.contactPhone").value(""))
                .andExpect(jsonPath("$.cnpjText").value(""))
                .andExpect(jsonPath("$.instagramHandle").value(""))
                .andExpect(jsonPath("$.citiesRail").value(""))
                .andExpect(jsonPath("$.copyrightText").value("Todos os direitos reservados."));
    }

    @Test
    void anonymousOrUnauthenticatedPatchIsForbidden() throws Exception {
        mockMvc.perform(patch("/api/storefront/footer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"wordmark\":\"NOVA MARCA\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanModifyAllFooterInformation() throws Exception {
        String bearer = "Bearer " + accessTokenService.issue("admin@example.test").value();

        String payload = """
                {
                  "wordmark": "KICKS TESTE",
                  "brandTagline": "Identidade configurada para teste",
                  "locationTitle": "LOCAL INFORMADO",
                  "addressLine1": "Endereço informado pelo administrador",
                  "addressLine2": "Cidade informada pelo administrador",
                  "hoursTitle": "HORÁRIOS INFORMADOS",
                  "storeHoursLine1": "Primeiro horário configurado",
                  "storeHoursLine2": "Segundo horário configurado",
                  "authTitle": "DECLARAÇÃO CONFIGURADA",
                  "authBadgeTitle": "Título cadastrado pelo administrador",
                  "authBadgeDetail": "Detalhe cadastrado pelo administrador",
                  "navTitle": "NAVEGAÇÃO CONFIGURADA",
                  "backToTopText": "Ir ao topo da página",
                  "contactEmail": "contato@example.test",
                  "contactPhone": "+55 00 00000-0000",
                  "cnpjText": "Documento empresarial configurado",
                  "instagramHandle": "@perfil_configurado",
                  "citiesRail": "UNIDADES CONFIGURADAS",
                  "copyrightText": "Texto legal configurado pelo administrador."
                }
                """;

        mockMvc.perform(patch("/api/storefront/footer")
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wordmark").value("KICKS TESTE"))
                .andExpect(jsonPath("$.brandTagline").value("Identidade configurada para teste"))
                .andExpect(jsonPath("$.locationTitle").value("LOCAL INFORMADO"))
                .andExpect(jsonPath("$.addressLine1").value("Endereço informado pelo administrador"))
                .andExpect(jsonPath("$.addressLine2").value("Cidade informada pelo administrador"))
                .andExpect(jsonPath("$.hoursTitle").value("HORÁRIOS INFORMADOS"))
                .andExpect(jsonPath("$.storeHoursLine1").value("Primeiro horário configurado"))
                .andExpect(jsonPath("$.storeHoursLine2").value("Segundo horário configurado"))
                .andExpect(jsonPath("$.authTitle").value("DECLARAÇÃO CONFIGURADA"))
                .andExpect(jsonPath("$.authBadgeTitle").value("Título cadastrado pelo administrador"))
                .andExpect(jsonPath("$.authBadgeDetail").value("Detalhe cadastrado pelo administrador"))
                .andExpect(jsonPath("$.navTitle").value("NAVEGAÇÃO CONFIGURADA"))
                .andExpect(jsonPath("$.backToTopText").value("Ir ao topo da página"))
                .andExpect(jsonPath("$.contactEmail").value("contato@example.test"))
                .andExpect(jsonPath("$.contactPhone").value("+55 00 00000-0000"))
                .andExpect(jsonPath("$.cnpjText").value("Documento empresarial configurado"))
                .andExpect(jsonPath("$.instagramHandle").value("@perfil_configurado"))
                .andExpect(jsonPath("$.citiesRail").value("UNIDADES CONFIGURADAS"))
                .andExpect(jsonPath("$.copyrightText").value("Texto legal configurado pelo administrador."));

        mockMvc.perform(get("/api/storefront/footer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wordmark").value("KICKS TESTE"))
                .andExpect(jsonPath("$.brandTagline").value("Identidade configurada para teste"))
                .andExpect(jsonPath("$.locationTitle").value("LOCAL INFORMADO"))
                .andExpect(jsonPath("$.addressLine1").value("Endereço informado pelo administrador"))
                .andExpect(jsonPath("$.contactEmail").value("contato@example.test"));
    }

    @Test
    void adminCanClearOptionalBusinessFields() throws Exception {
        String bearer = "Bearer " + accessTokenService.issue("admin@example.test").value();

        mockMvc.perform(patch("/api/storefront/footer")
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "locationTitle": "",
                                  "addressLine1": "",
                                  "addressLine2": "",
                                  "hoursTitle": "",
                                  "storeHoursLine1": "",
                                  "storeHoursLine2": "",
                                  "authTitle": "",
                                  "authBadgeTitle": "",
                                  "authBadgeDetail": "",
                                  "contactEmail": "",
                                  "contactPhone": "",
                                  "cnpjText": "",
                                  "instagramHandle": "",
                                  "citiesRail": ""
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.addressLine1").value(""))
                .andExpect(jsonPath("$.storeHoursLine1").value(""))
                .andExpect(jsonPath("$.authBadgeTitle").value(""))
                .andExpect(jsonPath("$.contactEmail").value(""))
                .andExpect(jsonPath("$.cnpjText").value(""))
                .andExpect(jsonPath("$.citiesRail").value(""));
    }
}
