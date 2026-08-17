package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.service.ReviewService;
import com.ecommerce.hardware.service.ReviewService.EligibilityView;
import com.ecommerce.hardware.service.ReviewService.ReviewItemView;
import com.ecommerce.hardware.service.ReviewService.ReviewsSummary;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ReviewController {

    private final ReviewService reviews;

    public ReviewController(ReviewService reviews) {
        this.reviews = reviews;
    }

    public record ReviewRequest(
            @NotNull(message = "A nota é obrigatória.")
            @Min(value = 1, message = "Nota mínima é 1 estrela.")
            @Max(value = 5, message = "Nota máxima é 5 estrelas.")
            Integer rating,

            @NotBlank(message = "O comentário é obrigatório.")
            @Size(max = 4000, message = "Comentário muito longo.")
            String comment
    ) { }

    @GetMapping("/reviews/store")
    public ReviewsSummary getStoreReviews() {
        return reviews.getStoreReviewsSummary();
    }

    @GetMapping("/customer/reviews/store/eligibility")
    public EligibilityView getStoreReviewEligibility(HttpSession session, HttpServletResponse response) {
        noStore(response);
        Long customerId = customerIdOrNull(session);
        return reviews.checkStoreReviewEligibility(customerId);
    }

    @PostMapping("/customer/reviews/store")
    public ResponseEntity<ReviewItemView> submitStoreReview(@Valid @RequestBody ReviewRequest request,
                                                           HttpSession session,
                                                           HttpServletResponse response) {
        noStore(response);
        Long customerId = requiredCustomerId(session);
        ReviewItemView created = reviews.createStoreReview(customerId, request.rating(), request.comment());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/reviews/products/{productId}")
    public ReviewsSummary getProductReviews(@PathVariable Long productId) {
        return reviews.getProductReviewsSummary(productId);
    }

    @GetMapping("/customer/reviews/products/{productId}/eligibility")
    public EligibilityView getProductReviewEligibility(@PathVariable Long productId,
                                                       HttpSession session,
                                                       HttpServletResponse response) {
        noStore(response);
        Long customerId = customerIdOrNull(session);
        return reviews.checkProductReviewEligibility(customerId, productId);
    }

    @PostMapping("/customer/reviews/products/{productId}")
    public ResponseEntity<ReviewItemView> submitProductReview(@PathVariable Long productId,
                                                              @Valid @RequestBody ReviewRequest request,
                                                              HttpSession session,
                                                              HttpServletResponse response) {
        noStore(response);
        Long customerId = requiredCustomerId(session);
        ReviewItemView created = reviews.createProductReview(customerId, productId, request.rating(), request.comment());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    private Long requiredCustomerId(HttpSession session) {
        Object value = session.getAttribute(CustomerAuthController.CUSTOMER_ID_SESSION_KEY);
        if (!(value instanceof Long customerId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Faça login com sua conta para continuar.");
        }
        return customerId;
    }

    private Long customerIdOrNull(HttpSession session) {
        Object value = session.getAttribute(CustomerAuthController.CUSTOMER_ID_SESSION_KEY);
        return value instanceof Long customerId ? customerId : null;
    }

    private static void noStore(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store, private");
        response.setHeader("Pragma", "no-cache");
    }
}
