package com.ecommerce.hardware.service;

import com.ecommerce.hardware.model.CustomerAccount;
import com.ecommerce.hardware.model.Product;
import com.ecommerce.hardware.model.ProductReview;
import com.ecommerce.hardware.model.StoreReview;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import com.ecommerce.hardware.repository.ProductRepository;
import com.ecommerce.hardware.repository.ProductReviewRepository;
import com.ecommerce.hardware.repository.PurchaseOrderRepository;
import com.ecommerce.hardware.repository.StoreReviewRepository;
import com.ecommerce.hardware.security.InputSanitizer;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ReviewService {

    private final StoreReviewRepository storeReviews;
    private final ProductReviewRepository productReviews;
    private final PurchaseOrderRepository orders;
    private final CustomerAccountRepository customers;
    private final ProductRepository products;

    public ReviewService(StoreReviewRepository storeReviews,
                         ProductReviewRepository productReviews,
                         PurchaseOrderRepository orders,
                         CustomerAccountRepository customers,
                         ProductRepository products) {
        this.storeReviews = storeReviews;
        this.productReviews = productReviews;
        this.orders = orders;
        this.customers = customers;
        this.products = products;
    }

    public record ReviewItemView(Long id, String authorName, Integer rating, String comment, Instant createdAt) {
        public static ReviewItemView from(StoreReview review) {
            return new ReviewItemView(review.getId(), review.getAuthorName(), review.getRating(), review.getComment(), review.getCreatedAt());
        }

        public static ReviewItemView from(ProductReview review) {
            return new ReviewItemView(review.getId(), review.getAuthorName(), review.getRating(), review.getComment(), review.getCreatedAt());
        }
    }

    public record ReviewsSummary(List<ReviewItemView> reviews, Double averageRating, Long totalCount) { }

    public record EligibilityView(boolean eligible, boolean alreadyReviewed, String reason) { }

    @Transactional(readOnly = true)
    public ReviewsSummary getStoreReviewsSummary() {
        List<StoreReview> list = storeReviews.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 50));
        Double avg = storeReviews.calculateAverageRating();
        long count = storeReviews.count();
        List<ReviewItemView> items = list.stream().map(ReviewItemView::from).toList();
        return new ReviewsSummary(items, avg == null ? 5.0 : Math.round(avg * 10.0) / 10.0, count);
    }

    @Transactional(readOnly = true)
    public EligibilityView checkStoreReviewEligibility(Long customerId) {
        if (customerId == null) {
            return new EligibilityView(false, false, "Faça login com sua conta para avaliar a loja.");
        }
        boolean alreadyReviewed = storeReviews.existsByCustomerId(customerId);
        if (alreadyReviewed) {
            return new EligibilityView(false, true, "Você já avaliou a loja. Obrigado!");
        }
        boolean hasPaidOrder = orders.hasApprovedOrder(customerId);
        if (!hasPaidOrder) {
            return new EligibilityView(false, false, "Apenas clientes com compras confirmadas podem avaliar a loja.");
        }
        return new EligibilityView(true, false, "Elegível para avaliar.");
    }

    @Transactional
    public ReviewItemView createStoreReview(Long customerId, int rating, String comment) {
        if (rating < 1 || rating > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A avaliação deve ser entre 1 e 5 estrelas.");
        }
        String cleanComment = InputSanitizer.sanitizeText(comment);
        if (cleanComment == null || cleanComment.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escreva um comentário para sua avaliação.");
        }
        if (cleanComment.length() > 4000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O comentário não pode exceder 4000 caracteres.");
        }

        CustomerAccount customer = customers.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Conta de cliente não encontrada."));

        EligibilityView eligibility = checkStoreReviewEligibility(customerId);
        if (!eligibility.eligible()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, eligibility.reason());
        }

        String rawAuthor = customer.getFullName() != null && !customer.getFullName().isBlank()
                ? customer.getFullName()
                : (customer.getEmail() != null ? customer.getEmail().split("@")[0] : "Cliente Verificado");
        String authorName = InputSanitizer.sanitizeText(rawAuthor);

        StoreReview review = new StoreReview(customer, authorName, rating, cleanComment);
        StoreReview saved = storeReviews.save(review);
        return ReviewItemView.from(saved);
    }

    @Transactional(readOnly = true)
    public ReviewsSummary getProductReviewsSummary(Long productId) {
        List<ProductReview> list = productReviews.findByProductIdOrderByCreatedAtDesc(productId, PageRequest.of(0, 50));
        Double avg = productReviews.calculateAverageRatingByProductId(productId);
        long count = productReviews.countByProductId(productId);
        List<ReviewItemView> items = list.stream().map(ReviewItemView::from).toList();
        return new ReviewsSummary(items, avg == null ? 5.0 : Math.round(avg * 10.0) / 10.0, count);
    }

    @Transactional(readOnly = true)
    public EligibilityView checkProductReviewEligibility(Long customerId, Long productId) {
        if (customerId == null) {
            return new EligibilityView(false, false, "Faça login com sua conta para avaliar este tênis.");
        }
        boolean alreadyReviewed = productReviews.existsByCustomerIdAndProductId(customerId, productId);
        if (alreadyReviewed) {
            return new EligibilityView(false, true, "Você já avaliou este modelo. Obrigado!");
        }
        boolean hasPaidOrder = orders.hasApprovedOrderForProduct(customerId, productId);
        if (!hasPaidOrder) {
            return new EligibilityView(false, false, "Apenas clientes que já compraram este tênis podem avaliá-lo.");
        }
        return new EligibilityView(true, false, "Elegível para avaliar este tênis.");
    }

    @Transactional
    public ReviewItemView createProductReview(Long customerId, Long productId, int rating, String comment) {
        if (rating < 1 || rating > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A avaliação deve ser entre 1 e 5 estrelas.");
        }
        String cleanComment = InputSanitizer.sanitizeText(comment);
        if (cleanComment == null || cleanComment.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Escreva um comentário para sua avaliação.");
        }
        if (cleanComment.length() > 4000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O comentário não pode exceder 4000 caracteres.");
        }

        CustomerAccount customer = customers.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Conta de cliente não encontrada."));

        Product product = products.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tênis não encontrado."));

        EligibilityView eligibility = checkProductReviewEligibility(customerId, productId);
        if (!eligibility.eligible()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, eligibility.reason());
        }

        String rawAuthor = customer.getFullName() != null && !customer.getFullName().isBlank()
                ? customer.getFullName()
                : (customer.getEmail() != null ? customer.getEmail().split("@")[0] : "Cliente Verificado");
        String authorName = InputSanitizer.sanitizeText(rawAuthor);

        ProductReview review = new ProductReview(customer, product, authorName, rating, cleanComment);
        ProductReview saved = productReviews.save(review);
        return ReviewItemView.from(saved);
    }
}
