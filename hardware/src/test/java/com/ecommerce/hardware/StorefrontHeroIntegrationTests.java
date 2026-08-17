package com.ecommerce.hardware;

import com.ecommerce.hardware.repository.StorefrontHeroImageRepository;
import com.ecommerce.hardware.repository.StorefrontHeroSettingsRepository;
import com.ecommerce.hardware.security.AdminAccessTokenService;
import com.ecommerce.hardware.service.ImageUploadValidator;
import com.ecommerce.hardware.service.StripePaymentGateway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$vADAsIj89J6CC52LDMhGsOyh0TOFIkjGJtUFgmkZQ6SddtSMSo0Wy",
        "app.stripe.reconciliation-interval-ms=86400000"
})
@AutoConfigureMockMvc
class StorefrontHeroIntegrationTests {

    private static final byte[] ONE_PIXEL_PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AdminAccessTokenService accessTokenService;

    @Autowired
    private StorefrontHeroImageRepository imageRepository;

    @Autowired
    private StorefrontHeroSettingsRepository settingsRepository;

    @MockitoBean
    private StripePaymentGateway stripePaymentGateway;

    @BeforeEach
    void resetHero() {
        imageRepository.deleteAll();
        settingsRepository.deleteAll();
    }

    @Test
    void defaultConfigurationIsPublicAndEveryWriteRequiresSignedBearer() throws Exception {
        mockMvc.perform(get("/api/storefront/hero"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("PRODUCTS"))
                .andExpect(jsonPath("$.intervalSeconds").value(5))
                .andExpect(jsonPath("$.manualImages").isEmpty());

        mockMvc.perform(patch("/api/storefront/hero")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"intervalSeconds\":7}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/storefront/hero")
                        .with(user("admin@example.test").roles("ADMIN"))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"intervalSeconds\":7}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(multipart("/api/storefront/hero/images")
                        .file(pngFile("blocked.png")))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/storefront/hero/images/1"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanUploadActivateServeAndDeleteAManualImage() throws Exception {
        String bearer = bearer();
        MvcResult uploaded = mockMvc.perform(multipart("/api/storefront/hero/images")
                        .file(pngFile("hero.png"))
                        .param("altText", "Tênis vermelho em destaque")
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("PRODUCTS"))
                .andExpect(jsonPath("$.manualImages[0].altText").value("Tênis vermelho em destaque"))
                .andExpect(jsonPath("$.manualImages[0].sortOrder").value(0))
                .andReturn();

        JsonNode uploadJson = JsonMapper.shared().readTree(uploaded.getResponse().getContentAsString());
        long imageId = uploadJson.path("manualImages").get(0).path("id").asLong();
        String imageUrl = uploadJson.path("manualImages").get(0).path("imageUrl").asText();
        assertEquals("/api/storefront/hero/images/" + imageId, imageUrl);

        mockMvc.perform(get(imageUrl))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(ONE_PIXEL_PNG))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL,
                        "max-age=31536000, public, immutable"));

        mockMvc.perform(patch("/api/storefront/hero")
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"MANUAL\",\"intervalSeconds\":7}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("MANUAL"))
                .andExpect(jsonPath("$.intervalSeconds").value(7));

        mockMvc.perform(get("/api/storefront/hero"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("MANUAL"))
                .andExpect(jsonPath("$.manualImages[0].imageUrl").value(imageUrl));

        mockMvc.perform(delete("/api/storefront/hero/images/{id}", imageId)
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("PRODUCTS"))
                .andExpect(jsonPath("$.manualImages").isEmpty());

        mockMvc.perform(get(imageUrl)).andExpect(status().isNotFound());
    }

    @Test
    void configurationAndUploadValidationEnforceTheGalleryContract() throws Exception {
        String bearer = bearer();

        mockMvc.perform(patch("/api/storefront/hero")
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"mode\":\"MANUAL\",\"intervalSeconds\":3}"))
                .andExpect(status().isBadRequest());

        for (int interval : new int[] {2, 31}) {
            mockMvc.perform(patch("/api/storefront/hero")
                            .header(HttpHeaders.AUTHORIZATION, bearer)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"intervalSeconds\":" + interval + "}"))
                    .andExpect(status().isBadRequest());
        }

        MockMultipartFile text = new MockMultipartFile("file", "not-image.txt",
                MediaType.TEXT_PLAIN_VALUE, "not an image".getBytes());
        mockMvc.perform(multipart("/api/storefront/hero/images")
                        .file(text)
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isUnsupportedMediaType());

        byte[] oversized = new byte[ImageUploadValidator.MAX_FILE_BYTES + 1];
        MockMultipartFile tooLarge = new MockMultipartFile("file", "large.png",
                MediaType.IMAGE_PNG_VALUE, oversized);
        mockMvc.perform(multipart("/api/storefront/hero/images")
                        .file(tooLarge)
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void galleryIsLimitedToEightImagesAndDeletionCompactsSortOrder() throws Exception {
        String bearer = bearer();
        long firstId = 0;
        for (int index = 0; index < 8; index++) {
            MvcResult result = mockMvc.perform(multipart("/api/storefront/hero/images")
                            .file(pngFile("hero-" + index + ".png"))
                            .header(HttpHeaders.AUTHORIZATION, bearer))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.manualImages[" + index + "].sortOrder").value(index))
                    .andReturn();
            if (index == 0) {
                firstId = JsonMapper.shared().readTree(result.getResponse().getContentAsString())
                        .path("manualImages").get(0).path("id").asLong();
            }
        }

        mockMvc.perform(multipart("/api/storefront/hero/images")
                        .file(pngFile("ninth.png"))
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isConflict());

        MvcResult deleted = mockMvc.perform(delete("/api/storefront/hero/images/{id}", firstId)
                        .header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.manualImages.length()").value(7))
                .andExpect(jsonPath("$.manualImages[0].sortOrder").value(0))
                .andExpect(jsonPath("$.manualImages[6].sortOrder").value(6))
                .andReturn();

        JsonNode remaining = JsonMapper.shared().readTree(deleted.getResponse().getContentAsString())
                .path("manualImages");
        assertFalse(remaining.isEmpty());
        assertTrue(imageRepository.findById(firstId).isEmpty());
        assertArrayEquals(ONE_PIXEL_PNG, Base64.getDecoder().decode(
                imageRepository.findById(remaining.get(0).path("id").asLong()).orElseThrow().getImageBase64()));
    }

    @Test
    void patchReordersEveryCurrentImageAndUpdatesItsAlternativeText() throws Exception {
        String bearer = bearer();
        long[] ids = new long[3];
        for (int index = 0; index < ids.length; index++) {
            MvcResult uploaded = mockMvc.perform(multipart("/api/storefront/hero/images")
                            .file(pngFile("ordered-" + index + ".png"))
                            .param("altText", "Original " + index)
                            .header(HttpHeaders.AUTHORIZATION, bearer))
                    .andExpect(status().isOk())
                    .andReturn();
            ids[index] = JsonMapper.shared().readTree(uploaded.getResponse().getContentAsString())
                    .path("manualImages").get(index).path("id").asLong();
        }

        String reordered = "{\"mode\":\"MANUAL\",\"intervalSeconds\":9,\"manualImages\":["
                + "{\"id\":" + ids[2] + ",\"altText\":\"Terceira primeiro\"},"
                + "{\"id\":" + ids[0] + ",\"altText\":\"Primeira depois\"},"
                + "{\"id\":" + ids[1] + ",\"altText\":\"Segunda por último\"}]}";
        mockMvc.perform(patch("/api/storefront/hero")
                        .header(HttpHeaders.AUTHORIZATION, bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reordered))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("MANUAL"))
                .andExpect(jsonPath("$.manualImages[0].id").value(ids[2]))
                .andExpect(jsonPath("$.manualImages[0].sortOrder").value(0))
                .andExpect(jsonPath("$.manualImages[0].altText").value("Terceira primeiro"))
                .andExpect(jsonPath("$.manualImages[1].id").value(ids[0]))
                .andExpect(jsonPath("$.manualImages[1].sortOrder").value(1))
                .andExpect(jsonPath("$.manualImages[2].id").value(ids[1]))
                .andExpect(jsonPath("$.manualImages[2].sortOrder").value(2));

        mockMvc.perform(get("/api/storefront/hero"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.manualImages[0].id").value(ids[2]))
                .andExpect(jsonPath("$.manualImages[1].altText").value("Primeira depois"))
                .andExpect(jsonPath("$.manualImages[2].altText").value("Segunda por último"));
    }

    @Test
    void patchRejectsDuplicateMissingOrForeignImageIdsWithoutChangingTheGallery() throws Exception {
        String bearer = bearer();
        long[] ids = new long[2];
        for (int index = 0; index < ids.length; index++) {
            MvcResult uploaded = mockMvc.perform(multipart("/api/storefront/hero/images")
                            .file(pngFile("validation-" + index + ".png"))
                            .header(HttpHeaders.AUTHORIZATION, bearer))
                    .andExpect(status().isOk())
                    .andReturn();
            ids[index] = JsonMapper.shared().readTree(uploaded.getResponse().getContentAsString())
                    .path("manualImages").get(index).path("id").asLong();
        }

        for (String invalidImages : new String[] {
                "[{\"id\":" + ids[0] + ",\"altText\":\"A\"}]",
                "[{\"id\":" + ids[0] + "},{\"id\":" + ids[0] + "}]",
                "[{\"id\":" + ids[0] + "},{\"id\":999999999}]",
                "[null,{\"id\":" + ids[1] + "}]"
        }) {
            mockMvc.perform(patch("/api/storefront/hero")
                            .header(HttpHeaders.AUTHORIZATION, bearer)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"manualImages\":" + invalidImages + "}"))
                    .andExpect(status().isBadRequest());
        }

        mockMvc.perform(get("/api/storefront/hero"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.manualImages.length()").value(2))
                .andExpect(jsonPath("$.manualImages[0].id").value(ids[0]))
                .andExpect(jsonPath("$.manualImages[0].sortOrder").value(0))
                .andExpect(jsonPath("$.manualImages[1].id").value(ids[1]))
                .andExpect(jsonPath("$.manualImages[1].sortOrder").value(1));
    }

    private String bearer() {
        return "Bearer " + accessTokenService.issue("admin@example.test").value();
    }

    private MockMultipartFile pngFile(String filename) {
        return new MockMultipartFile("file", filename, MediaType.IMAGE_PNG_VALUE, ONE_PIXEL_PNG);
    }
}
