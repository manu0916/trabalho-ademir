package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.security.AdminAccessTokenService;
import com.ecommerce.hardware.service.ImageUrlResolver;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;
    private final ImageUrlResolver imageUrlResolver;
    private final AdminAccessTokenService adminAccessTokenService;

    public ProductController(ProductRepository productRepository, ImageUrlResolver imageUrlResolver,
                             AdminAccessTokenService adminAccessTokenService) {
        this.productRepository = productRepository;
        this.imageUrlResolver = imageUrlResolver;
        this.adminAccessTokenService = adminAccessTokenService;
    }

    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAllProducts() {
        List<ProductResponse> products = productRepository.findAllByOrderByIdDesc().stream()
                .map(ProductResponse::from)
                .toList();
        return ResponseEntity.ok(products);
    }

    @PostMapping
    public ResponseEntity<ProductResponse> createProduct(@Valid @RequestBody ProductRequest request,
                                                         @RequestHeader(value = HttpHeaders.AUTHORIZATION,
                                                                 required = false) String authorization) {
        requireAdmin(request.adminAccessToken(), authorization);
        Product product = new Product();
        product.setName(request.name().trim());
        product.setCategory(request.category() == null || request.category().isBlank() ? "Produto" : request.category().trim());
        product.setPrice(request.price());
        product.setStockQuantity(request.stockQuantity());
        product.setDescription(request.description() == null ? null : request.description().trim());
        product.setImageUrl(imageUrlResolver.resolve(request.imageUrl()));

        Product savedProduct = productRepository.save(product);
        return ResponseEntity.status(HttpStatus.CREATED).body(ProductResponse.from(savedProduct));
    }

    @PatchMapping("/{id}/stock")
    public ProductResponse updateStock(@PathVariable Long id, @Valid @RequestBody ProductStockRequest request,
                                       @RequestHeader(value = HttpHeaders.AUTHORIZATION,
                                               required = false) String authorization) {
        requireAdmin(request.adminAccessToken(), authorization);
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND, "Produto não encontrado."));
        product.setStockQuantity(request.stockQuantity());
        return ProductResponse.from(productRepository.save(product));
    }

    private void requireAdmin(String bodyToken, String authorization) {
        if (isValidToken(bodyToken) || isValidToken(extractBearerToken(authorization))) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acesso negado.");
    }

    private boolean isValidToken(String token) {
        return token != null && adminAccessTokenService.validate(token).isPresent();
    }

    private String extractBearerToken(String authorization) {
        if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        return authorization.substring(7).trim();
    }
}
