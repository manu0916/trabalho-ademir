package com.ecommerce.hardware;

import com.ecommerce.hardware.service.StripePaymentGateway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.security.web.transport.HttpsRedirectFilter;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$vADAsIj89J6CC52LDMhGsOyh0TOFIkjGJtUFgmkZQ6SddtSMSo0Wy",
        "app.security.enforce-https=true",
        "app.stripe.reconciliation-interval-ms=86400000"
})
@AutoConfigureMockMvc
class HttpsSecurityConfigurationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FilterChainProxy springSecurityFilterChain;

    @MockitoBean
    private StripePaymentGateway stripePaymentGateway;

    @Test
    void enforceHttpsBuildsSupportedRedirectFilterWithoutLegacyChannelClasses() {
        assertTrue(springSecurityFilterChain.getFilterChains().stream()
                .flatMap(chain -> chain.getFilters().stream())
                .anyMatch(HttpsRedirectFilter.class::isInstance));
    }

    @Test
    void insecureRequestRedirectsToHttps() throws Exception {
        mockMvc.perform(get("/api/health").secure(false))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", "https://localhost/api/health"));
    }

    @Test
    void requestAlreadyMarkedSecureDoesNotRedirect() throws Exception {
        mockMvc.perform(get("/api/health").with(request -> {
                    request.setSecure(true);
                    request.setScheme("https");
                    request.setServerPort(443);
                    return request;
                }))
                .andExpect(status().isOk());
    }
}
