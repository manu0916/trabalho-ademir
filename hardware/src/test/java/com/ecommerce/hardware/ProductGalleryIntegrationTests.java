package com.ecommerce.hardware;

import com.ecommerce.hardware.repository.ProductImageRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.security.AdminAccessTokenService;
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

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.admin.email=admin@example.test",
        "app.admin.password-hash=$2a$10$vADAsIj89J6CC52LDMhGsOyh0TOFIkjGJtUFgmkZQ6SddtSMSo0Wy",
        "app.stripe.reconciliation-interval-ms=86400000"
})
@AutoConfigureMockMvc
class ProductGalleryIntegrationTests {

    private static final byte[] ONE_PIXEL_PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
    private static final byte[] ONE_PIXEL_WEBP = Base64.getDecoder().decode(
            "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AdminAccessTokenService accessTokenService;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductImageRepository imageRepository;

    @MockitoBean
    private StripePaymentGateway stripePaymentGateway;

    @BeforeEach
    void resetProducts() {
        imageRepository.deleteAll();
        productRepository.deleteAll();
    }

    @Test
    void multipartCreationRequiresBearerAndPersistsAnOrderedPublicGallery() throws Exception {
        mockMvc.perform(multipart("/api/products")
                        .file(productPart("Produto bloqueado"))
                        .file(png("images", "blocked.png")))
                .andExpect(status().isForbidden());

        MvcResult created = mockMvc.perform(multipart("/api/products")
                        .file(productPart("Tênis com galeria"))
                        .file(png("images", "front.png"))
                        .file(webp("images", "side.webp"))
                        .file(jpeg("images", "back.jpg"))
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Tênis com galeria"))
                .andExpect(jsonPath("$.images.length()").value(3))
                .andExpect(jsonPath("$.images[0].sortOrder").value(0))
                .andExpect(jsonPath("$.images[1].sortOrder").value(1))
                .andExpect(jsonPath("$.images[2].sortOrder").value(2))
                .andExpect(jsonPath("$.imageUrl").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.emptyOrNullString())))
                .andReturn();

        JsonNode body = JsonMapper.shared().readTree(created.getResponse().getContentAsString());
        long productId = body.path("id").asLong();
        long firstImageId = body.path("images").get(0).path("id").asLong();
        String firstImageUrl = "/api/products/" + productId + "/images/" + firstImageId;
        assertEquals(firstImageUrl, body.path("imageUrl").asText());
        assertEquals(firstImageUrl, body.path("images").get(0).path("imageUrl").asText());

        mockMvc.perform(get(firstImageUrl))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(ONE_PIXEL_PNG))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL,
                        "max-age=31536000, public, immutable"));
        mockMvc.perform(get("/api/products/{productId}/images/{imageId}", productId + 1, firstImageId))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(productId))
                .andExpect(jsonPath("$[0].imageUrl").value(firstImageUrl))
                .andExpect(jsonPath("$[0].images.length()").value(3))
                .andExpect(jsonPath("$[0].images[0].imageUrl").value(firstImageUrl));
    }

    @Test
    void extensionUploadPersistsAndServesWebpWithItsDetectedMediaType() throws Exception {
        MvcResult tokenResult = mockMvc.perform(post("/api/admin/auth/token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@example.test\",\"password\":\"password1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = JsonMapper.shared().readTree(tokenResult.getResponse().getContentAsString())
                .path("accessToken").asText();

        MvcResult created = mockMvc.perform(multipart("/api/products")
                        .file(productPart("WebP da extensão"))
                        .file(webp("images", "shoe-image-1.webp"))
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.images.length()").value(1))
                .andReturn();

        JsonNode body = JsonMapper.shared().readTree(created.getResponse().getContentAsString());
        String imageUrl = body.path("images").get(0).path("imageUrl").asText();
        mockMvc.perform(get(imageUrl))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.parseMediaType("image/webp")))
                .andExpect(content().bytes(ONE_PIXEL_WEBP));

        var storedImage = imageRepository.findAll().getFirst();
        assertEquals("image/webp", storedImage.getContentType());
        assertEquals(ONE_PIXEL_WEBP.length, storedImage.getByteSize());
        assertArrayEquals(ONE_PIXEL_WEBP,
                Base64.getDecoder().decode(storedImage.getImageBase64()));
    }

    @Test
    void multipartCreationAcceptsOneThroughEightImagesAndRejectsNine() throws Exception {
        mockMvc.perform(multipart("/api/products")
                        .file(productPart("Sem imagem"))
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isBadRequest());

        mockMvc.perform(multipart("/api/products")
                        .file(productPart("Uma imagem"))
                        .file(png("images", "only.png"))
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.images.length()").value(1));

        var eight = multipart("/api/products").file(productPart("Oito imagens"));
        for (int index = 0; index < 8; index++) eight.file(png("images", "image-" + index + ".png"));
        mockMvc.perform(eight.header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.images.length()").value(8))
                .andExpect(jsonPath("$.images[7].sortOrder").value(7));

        var nine = multipart("/api/products").file(productPart("Nove imagens"));
        for (int index = 0; index < 9; index++) nine.file(png("images", "image-" + index + ".png"));
        mockMvc.perform(nine.header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cada produto aceita no máximo 8 imagens."));
    }

    @Test
    void uploadValidatesImageSignatureDimensionsAndDeclaredTypeBeforeWriting() throws Exception {
        byte[] corruptPng = {(byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a};
        MockMultipartFile corrupt = new MockMultipartFile("images", "corrupt.png",
                MediaType.IMAGE_PNG_VALUE, corruptPng);
        mockMvc.perform(multipart("/api/products")
                        .file(productPart("PNG inválido"))
                        .file(corrupt)
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isBadRequest());

        MockMultipartFile headerOnlyPng = new MockMultipartFile("images", "header-only.png",
                MediaType.IMAGE_PNG_VALUE, Arrays.copyOf(ONE_PIXEL_PNG, 33));
        mockMvc.perform(multipart("/api/products")
                        .file(productPart("PNG truncado"))
                        .file(headerOnlyPng)
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isBadRequest());

        byte[] completeJpeg = jpeg("images", "complete.jpg").getBytes();
        MockMultipartFile truncatedJpeg = new MockMultipartFile("images", "truncated.jpg",
                MediaType.IMAGE_JPEG_VALUE, Arrays.copyOf(completeJpeg, completeJpeg.length - 2));
        mockMvc.perform(multipart("/api/products")
                        .file(productPart("JPEG truncado"))
                        .file(truncatedJpeg)
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isBadRequest());

        MockMultipartFile mismatched = new MockMultipartFile("images", "fake.jpg",
                MediaType.IMAGE_JPEG_VALUE, ONE_PIXEL_PNG);
        mockMvc.perform(multipart("/api/products")
                        .file(productPart("Tipo inválido"))
                        .file(mismatched)
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isUnsupportedMediaType());

        assertEquals(0, productRepository.count());
        assertEquals(0, imageRepository.count());
    }

    @Test
    void legacyJsonUrlCreationRemainsCompatibleAndReturnsAnEmptyGallery() throws Exception {
        mockMvc.perform(post("/api/products")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Produto legado\",\"category\":\"Tênis\",\"price\":99.90,"
                                + "\"stockQuantity\":2,\"imageUrl\":\"https://example.com/legacy.png\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("Tênis"))
                .andExpect(jsonPath("$.imageUrl").value("https://example.com/legacy.png"))
                .andExpect(jsonPath("$.images").isEmpty());

        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].imageUrl").value("https://example.com/legacy.png"))
                .andExpect(jsonPath("$[0].images").isEmpty());
    }

    @Test
    void browserLocalDataAndBlobUrlsAreNotPersistedAsPublicProductUrls() throws Exception {
        String[] browserLocalUrls = {
                "data:image/webp;base64,UklGRiIAAABXRUJQ",
                "blob:https://shop.example/218a1b26-33a8-4aa2-91ef-faa8dce18204"
        };

        for (String imageUrl : browserLocalUrls) {
            String body = "{\"name\":\"URL local\",\"category\":\"Basquete\",\"price\":99.90,"
                    + "\"stockQuantity\":2,\"imageUrl\":\"" + imageUrl + "\"}";
            mockMvc.perform(post("/api/products")
                            .header(HttpHeaders.AUTHORIZATION, bearer())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }

        assertEquals(0, productRepository.count());
        assertEquals(0, imageRepository.count());
    }

    @Test
    void multipartCreationCanonicalizesSportsCategoriesAndRejectsUnknownOnes() throws Exception {
        mockMvc.perform(multipart("/api/products")
                        .file(productPart("Categoria inválida", "Tênis"))
                        .file(png("images", "invalid.png"))
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        "Categoria inválida. Escolha entre: Basquete, Vôlei, Handball, Futsal ou Futebol."));
        assertEquals(0, productRepository.count());
        assertEquals(0, imageRepository.count());

        mockMvc.perform(multipart("/api/products")
                        .file(productPart("Tênis de vôlei", "  vÔLeI  "))
                        .file(png("images", "volleyball.png"))
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("Vôlei"));

        mockMvc.perform(multipart("/api/products")
                        .file(productPart("Tênis de handball", "Handebol"))
                        .file(png("images", "handball.png"))
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("Handball"));
    }

    @Test
    void legacyJsonCreationCanonicalizesKnownCategoryButKeepsUnknownHistoricalCategory() throws Exception {
        mockMvc.perform(post("/api/products")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Legado conhecido\",\"category\":\"handebol\",\"price\":99.90,"
                                + "\"stockQuantity\":2,\"imageUrl\":\"https://example.com/known.png\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("Handball"));

        mockMvc.perform(post("/api/products")
                        .header(HttpHeaders.AUTHORIZATION, bearer())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Legado histórico\",\"category\":\"  Corrida  \",\"price\":99.90,"
                                + "\"stockQuantity\":2,\"imageUrl\":\"https://example.com/historical.png\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("Corrida"));
    }

    @Test
    void deleteProduct_whenAuthenticated_deletesProductAndImages() throws Exception {
        MvcResult created = mockMvc.perform(multipart("/api/products")
                        .file(productPart("Tênis para Excluir"))
                        .file(webp("images", "foto1.webp"))
                        .file(webp("images", "foto2.webp"))
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode body = JsonMapper.builder().build().readTree(created.getResponse().getContentAsString());
        long productId = body.get("id").asLong();

        assertEquals(1, productRepository.count());
        assertEquals(2, imageRepository.count());

        mockMvc.perform(delete("/api/products/" + productId)
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isNoContent());

        assertEquals(0, productRepository.count());
        assertEquals(0, imageRepository.count());
    }

    @Test
    void deleteProduct_whenUnauthenticated_returnsForbidden() throws Exception {
        mockMvc.perform(delete("/api/products/999"))
                .andExpect(status().isForbidden());
    }

    @Test
    void deleteProduct_whenNotFound_returnsNotFound() throws Exception {
        mockMvc.perform(delete("/api/products/99999")
                        .header(HttpHeaders.AUTHORIZATION, bearer()))
                .andExpect(status().isNotFound());
    }

    private String bearer() {
        return "Bearer " + accessTokenService.issue("admin@example.test").value();
    }

    private MockMultipartFile productPart(String name) {
        return productPart(name, "Basquete");
    }

    private MockMultipartFile productPart(String name, String category) {
        String json = "{\"name\":\"" + name + "\",\"category\":\"" + category + "\",\"price\":299.90,"
                + "\"stockQuantity\":5,\"description\":\"Produto com fotos\"}";
        return new MockMultipartFile("product", "", MediaType.APPLICATION_JSON_VALUE,
                json.getBytes(StandardCharsets.UTF_8));
    }

    private MockMultipartFile png(String partName, String filename) {
        return new MockMultipartFile(partName, filename, MediaType.IMAGE_PNG_VALUE, ONE_PIXEL_PNG);
    }

    private MockMultipartFile webp(String partName, String filename) {
        return new MockMultipartFile(partName, filename, "image/webp", ONE_PIXEL_WEBP);
    }

    private MockMultipartFile jpeg(String partName, String filename) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "jpeg", output);
            return new MockMultipartFile(partName, filename, MediaType.IMAGE_JPEG_VALUE, output.toByteArray());
        } catch (IOException exception) {
            throw new IllegalStateException("Could not create test JPEG", exception);
        }
    }
}
