package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.service.ProductService;
import com.ecommerce.hardware.service.ProductService.StoredProductImage;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAllProducts() {
        return ResponseEntity.ok(productService.listProducts());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ProductResponse> createLegacyProduct(@Valid @RequestBody ProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(productService.createLegacyProduct(request));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProductResponse> createProduct(
            @Valid @RequestPart("product") ProductUploadRequest request,
            @RequestPart("images") List<MultipartFile> images) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(productService.createProductWithImages(request, images));
    }

    @PatchMapping("/{id}/stock")
    public ProductResponse updateStock(@PathVariable Long id, @Valid @RequestBody ProductStockRequest request) {
        return productService.updateStock(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id) {
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public CatalogDeletionResponse deleteCatalog(@RequestBody(required = false) CatalogDeletionRequest request) {
        if (request == null || !ProductService.CATALOG_DELETE_CONFIRMATION.equals(request.confirmation())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Confirmação inválida. Digite APAGAR CATALOGO para continuar.");
        }
        ProductService.CatalogDeletionResult result = productService.deleteCatalog();
        return new CatalogDeletionResponse(result.deletedProducts(), result.deletedImages(),
                result.deletedReviews(), result.deletedStockAlerts());
    }

    @GetMapping("/{productId}/images/{imageId}")
    public ResponseEntity<byte[]> image(@PathVariable Long productId, @PathVariable Long imageId) {
        StoredProductImage image = productService.getImage(productId, imageId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .contentLength(image.bytes().length)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .eTag("\"product-image-" + image.id() + "\"")
                .body(image.bytes());
    }

    public record CatalogDeletionRequest(String confirmation) {
    }

    public record CatalogDeletionResponse(long deletedProducts, long deletedImages,
                                          long deletedReviews, long deletedStockAlerts) {
    }

}
