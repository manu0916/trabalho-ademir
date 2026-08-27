package com.ecommerce.hardware.service;

import com.ecommerce.hardware.controller.ProductRequest;
import com.ecommerce.hardware.controller.ProductResponse;
import com.ecommerce.hardware.controller.ProductResponse.ProductImageResponse;
import com.ecommerce.hardware.controller.ProductStockRequest;
import com.ecommerce.hardware.controller.ProductUploadRequest;
import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.model.ProductCategory;
import com.ecommerce.hardware.model.ProductImage;
import com.ecommerce.hardware.repository.ProductImageRepository;
import com.ecommerce.hardware.repository.ProductImageRepository.ProductImageMetadata;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.ProductReviewRepository;
import com.ecommerce.hardware.repository.StockAlertRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ProductService {

    public static final int MAX_IMAGES = 8;
    public static final String CATALOG_DELETE_CONFIRMATION = "APAGAR CATALOGO";
    private static final String IMAGE_URL_PREFIX = "/api/products/";

    private final ProductRepository productRepository;
    private final ProductImageRepository imageRepository;
    private final ProductReviewRepository reviewRepository;
    private final StockAlertRepository stockAlertRepository;
    private final ImageUrlResolver imageUrlResolver;
    private final ImageUploadValidator imageValidator;

    public ProductService(ProductRepository productRepository,
                          ProductImageRepository imageRepository,
                          ProductReviewRepository reviewRepository,
                          StockAlertRepository stockAlertRepository,
                          ImageUrlResolver imageUrlResolver,
                          ImageUploadValidator imageValidator) {
        this.productRepository = productRepository;
        this.imageRepository = imageRepository;
        this.reviewRepository = reviewRepository;
        this.stockAlertRepository = stockAlertRepository;
        this.imageUrlResolver = imageUrlResolver;
        this.imageValidator = imageValidator;
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> listProducts() {
        List<Product> products = productRepository.findAllByOrderByIdDesc();
        if (products.isEmpty()) return List.of();

        List<Long> productIds = products.stream().map(Product::getId).toList();
        Map<Long, List<ProductImageResponse>> imagesByProduct = new HashMap<>();
        for (ProductImageMetadata image : imageRepository.findMetadataByProductIds(productIds)) {
            imagesByProduct.computeIfAbsent(image.getProductId(), ignored -> new ArrayList<>())
                    .add(imageResponse(image.getProductId(), image.getId(), image.getSortOrder()));
        }
        return products.stream()
                .map(product -> response(product, imagesByProduct.getOrDefault(product.getId(), List.of())))
                .toList();
    }

    /** Keeps the original JSON + HTTPS URL contract working for older clients. */
    @Transactional
    public ProductResponse createLegacyProduct(ProductRequest request) {
        Product product = productFrom(request.name(), normalizeKnownLegacyCategory(request.category()), request.price(),
                request.stockQuantity(), request.description());
        product.setImageUrl(imageUrlResolver.resolve(request.imageUrl()));
        return response(productRepository.save(product), List.of());
    }

    @Transactional
    public ProductResponse createProductWithImages(ProductUploadRequest request, List<MultipartFile> images) {
        String normalizedCategory = requireCatalogCategory(request.category());
        if (images == null || images.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Selecione pelo menos uma imagem do produto.");
        }
        if (images.size() > MAX_IMAGES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cada produto aceita no máximo 8 imagens.");
        }

        // Validate every file before inserting anything. This also bounds the total in-memory
        // payload to eight validated two-megabyte images.
        List<ImageUploadValidator.ValidatedImage> validatedImages = images.stream()
                .map(imageValidator::validate)
                .toList();

        Product product = productRepository.saveAndFlush(productFrom(request.name(), normalizedCategory,
                request.price(), request.stockQuantity(), request.description()));
        List<ProductImage> storedImages = new ArrayList<>(validatedImages.size());
        for (int index = 0; index < validatedImages.size(); index++) {
            ImageUploadValidator.ValidatedImage validated = validatedImages.get(index);
            ProductImage image = new ProductImage();
            image.setProduct(product);
            image.setContentType(validated.contentType());
            image.setByteSize(validated.bytes().length);
            image.setImageBase64(Base64.getEncoder().encodeToString(validated.bytes()));
            image.setSortOrder(index);
            storedImages.add(image);
        }
        storedImages = imageRepository.saveAllAndFlush(storedImages);

        List<ProductImageResponse> responseImages = storedImages.stream()
                .map(image -> imageResponse(product.getId(), image.getId(), image.getSortOrder()))
                .toList();
        product.setImageUrl(responseImages.getFirst().imageUrl());
        productRepository.saveAndFlush(product);
        return response(product, responseImages);
    }

    @Transactional
    public ProductResponse updateStock(Long id, ProductStockRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Produto não encontrado."));
        product.setStockQuantity(request.stockQuantity());
        Product saved = productRepository.save(product);
        List<ProductImageResponse> images = imageRepository.findMetadataByProductIds(List.of(id)).stream()
                .map(image -> imageResponse(id, image.getId(), image.getSortOrder()))
                .toList();
        return response(saved, images);
    }

    @Transactional
    public CatalogDeletionResult deleteCatalog() {
        long deletedProducts = productRepository.count();
        long deletedImages = imageRepository.count();
        long deletedReviews = reviewRepository.count();
        long deletedStockAlerts = stockAlertRepository.count();

        reviewRepository.deleteAllInBatch();
        imageRepository.deleteAllInBatch();
        stockAlertRepository.deleteAllInBatch();
        productRepository.deleteAllInBatch();

        return new CatalogDeletionResult(deletedProducts, deletedImages, deletedReviews, deletedStockAlerts);
    }

    @Transactional(readOnly = true)
    public StoredProductImage getImage(Long productId, Long imageId) {
        ProductImage image = imageRepository.findByIdAndProduct_Id(imageId, productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Imagem do produto não encontrada."));
        try {
            return new StoredProductImage(image.getId(), image.getContentType(),
                    Base64.getDecoder().decode(image.getImageBase64()));
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "A imagem armazenada não pôde ser lida.");
        }
    }

    private Product productFrom(String name, String category, java.math.BigDecimal price,
                                Integer stockQuantity, String description) {
        Product product = new Product();
        product.setName(name.trim());
        product.setCategory(category == null || category.isBlank() ? "Produto" : category.trim());
        product.setPrice(price);
        product.setStockQuantity(stockQuantity);
        product.setDescription(description == null ? null : description.trim());
        return product;
    }

    private String requireCatalogCategory(String category) {
        return ProductCategory.fromInput(category)
                .map(ProductCategory::label)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Categoria inválida. Escolha entre: " + ProductCategory.allowedLabels() + "."));
    }

    /**
     * The URL-based JSON endpoint remains compatible with historical clients and
     * arbitrary old categories. Known sports categories are still canonicalized so
     * that new storefront divisions group them consistently.
     */
    private String normalizeKnownLegacyCategory(String category) {
        if (category == null || category.isBlank()) return category;
        return ProductCategory.fromInput(category)
                .map(ProductCategory::label)
                .orElseGet(category::trim);
    }

    private ProductResponse response(Product product, List<ProductImageResponse> images) {
        String coverUrl = images.isEmpty() ? product.getImageUrl() : images.getFirst().imageUrl();
        return new ProductResponse(product.getId(), product.getName(), product.getCategory(), product.getPrice(),
                product.getStockQuantity(), product.getDescription(), coverUrl, List.copyOf(images));
    }

    private ProductImageResponse imageResponse(Long productId, Long imageId, Integer sortOrder) {
        return new ProductImageResponse(imageId,
                IMAGE_URL_PREFIX + productId + "/images/" + imageId, sortOrder);
    }

    public record StoredProductImage(Long id, String contentType, byte[] bytes) {
    }

    public record CatalogDeletionResult(long deletedProducts, long deletedImages,
                                        long deletedReviews, long deletedStockAlerts) {
    }
}
