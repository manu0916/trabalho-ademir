package com.ecommerce.hardware;

import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.model.ProductImage;
import com.ecommerce.hardware.model.StockAlert;
import com.ecommerce.hardware.repository.ProductImageRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.ProductReviewRepository;
import com.ecommerce.hardware.repository.StockAlertRepository;
import com.ecommerce.hardware.security.AdminAccessTokenService;
import com.ecommerce.hardware.service.StripePaymentGateway;
import java.math.BigDecimal;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$vADAsIj89J6CC52LDMhGsOyh0TOFIkjGJtUFgmkZQ6SddtSMSo0Wy",
        "app.stripe.reconciliation-interval-ms=86400000"
})
@AutoConfigureMockMvc
class CatalogDeletionIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AdminAccessTokenService accessTokenService;

    @Autowired
    private ProductRepository products;

    @Autowired
    private ProductImageRepository images;

    @Autowired
    private ProductReviewRepository reviews;

    @Autowired
    private StockAlertRepository stockAlerts;

    @MockitoBean
    private StripePaymentGateway stripePaymentGateway;

    @BeforeEach
    void resetCatalog() {
        reviews.deleteAllInBatch();
        images.deleteAllInBatch();
        stockAlerts.deleteAllInBatch();
        products.deleteAllInBatch();
    }

    @Test
    void catalogDeletionRequiresBearerAndExactTypedConfirmation() throws Exception {
        seedCatalog();

        mockMvc.perform(delete("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmation\":\"APAGAR CATALOGO\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/products")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmation\":\"apagar\"}"))
                .andExpect(status().isBadRequest());

        org.junit.jupiter.api.Assertions.assertEquals(2, products.count());
    }

    @Test
    void confirmedDeletionRemovesCatalogAssetsAndAlerts() throws Exception {
        seedCatalog();

        mockMvc.perform(delete("/api/products")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmation\":\"APAGAR CATALOGO\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletedProducts").value(2))
                .andExpect(jsonPath("$.deletedImages").value(1))
                .andExpect(jsonPath("$.deletedReviews").value(0))
                .andExpect(jsonPath("$.deletedStockAlerts").value(1));

        org.junit.jupiter.api.Assertions.assertEquals(0, products.count());
        org.junit.jupiter.api.Assertions.assertEquals(0, images.count());
        org.junit.jupiter.api.Assertions.assertEquals(0, stockAlerts.count());
    }

    private void seedCatalog() {
        Product first = product("Tênis Solar");
        Product second = product("Tênis Lunar");
        products.saveAllAndFlush(java.util.List.of(first, second));

        ProductImage image = new ProductImage();
        image.setProduct(first);
        image.setContentType(MediaType.IMAGE_PNG_VALUE);
        image.setByteSize(1);
        image.setImageBase64(Base64.getEncoder().encodeToString(new byte[]{1}));
        image.setSortOrder(0);
        images.saveAndFlush(image);

        stockAlerts.saveAndFlush(new StockAlert(first.getId(), first.getName(), "40", "Preto",
                "cliente@example.test", null));
    }

    private Product product(String name) {
        Product product = new Product();
        product.setName(name);
        product.setCategory("Basquete");
        product.setPrice(new BigDecimal("299.90"));
        product.setStockQuantity(5);
        return product;
    }

    private String bearer() {
        return "Bearer " + accessTokenService.issue("admin@example.test").value();
    }
}
