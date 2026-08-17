package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.DiscountCoupon;
import com.ecommerce.hardware.repository.DiscountCouponRepository;
import com.ecommerce.hardware.security.InputSanitizer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class CouponController {

    private final DiscountCouponRepository coupons;

    public CouponController(DiscountCouponRepository coupons) {
        this.coupons = coupons;
    }

    public record CouponValidationResponse(
            boolean valid,
            String code,
            BigDecimal discountAmount,
            BigDecimal originalAmount,
            BigDecimal finalAmount,
            String message
    ) { }

    public record CreateCouponRequest(
            @NotBlank(message = "O código do cupom é obrigatório.")
            @Size(max = 40, message = "Código do cupom muito longo.")
            String code,

            BigDecimal discountPercent,
            BigDecimal discountAmount,
            BigDecimal minOrderValue,
            Integer maxUses,
            Instant expiresAt
    ) { }

    public record CouponView(
            Long id,
            String code,
            BigDecimal discountPercent,
            BigDecimal discountAmount,
            BigDecimal minOrderValue,
            Integer maxUses,
            Integer usedCount,
            Instant expiresAt,
            boolean active,
            Instant createdAt
    ) {
        public static CouponView from(DiscountCoupon c) {
            return new CouponView(
                    c.getId(),
                    c.getCode(),
                    c.getDiscountPercent(),
                    c.getDiscountAmount(),
                    c.getMinOrderValue(),
                    c.getMaxUses(),
                    c.getUsedCount(),
                    c.getExpiresAt(),
                    c.isActive(),
                    c.getCreatedAt()
            );
        }
    }

    @GetMapping("/coupons/validate")
    @Transactional(readOnly = true)
    public CouponValidationResponse validateCoupon(
            @RequestParam("code") String code,
            @RequestParam(value = "amount", defaultValue = "0") BigDecimal amount) {

        String cleanCode = InputSanitizer.sanitizeText(code);
        if (cleanCode == null || cleanCode.isBlank()) {
            return new CouponValidationResponse(false, "", BigDecimal.ZERO, amount, amount, "Informe um código de cupom.");
        }

        DiscountCoupon coupon = coupons.findByCodeIgnoreCase(cleanCode.toUpperCase().trim())
                .orElse(null);

        if (coupon == null || !coupon.isActive()) {
            return new CouponValidationResponse(false, cleanCode, BigDecimal.ZERO, amount, amount, "Cupom inválido ou inativo.");
        }

        if (coupon.getExpiresAt() != null && coupon.getExpiresAt().isBefore(Instant.now())) {
            return new CouponValidationResponse(false, cleanCode, BigDecimal.ZERO, amount, amount, "Este cupom já expirou.");
        }

        if (coupon.getMaxUses() != null && coupon.getUsedCount() >= coupon.getMaxUses()) {
            return new CouponValidationResponse(false, cleanCode, BigDecimal.ZERO, amount, amount, "Limite de utilizações deste cupom atingido.");
        }

        if (coupon.getMinOrderValue() != null && amount.compareTo(coupon.getMinOrderValue()) < 0) {
            return new CouponValidationResponse(false, cleanCode, BigDecimal.ZERO, amount, amount,
                    "Valor mínimo de compra para este cupom é de R$ " + coupon.getMinOrderValue().setScale(2, RoundingMode.HALF_UP));
        }

        BigDecimal calculatedDiscount = BigDecimal.ZERO;
        if (coupon.getDiscountPercent() != null && coupon.getDiscountPercent().compareTo(BigDecimal.ZERO) > 0) {
            calculatedDiscount = amount.multiply(coupon.getDiscountPercent())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        } else if (coupon.getDiscountAmount() != null && coupon.getDiscountAmount().compareTo(BigDecimal.ZERO) > 0) {
            calculatedDiscount = coupon.getDiscountAmount();
        }

        if (calculatedDiscount.compareTo(amount) > 0) {
            calculatedDiscount = amount;
        }

        BigDecimal finalAmount = amount.subtract(calculatedDiscount).max(BigDecimal.ZERO);

        return new CouponValidationResponse(
                true,
                coupon.getCode(),
                calculatedDiscount,
                amount,
                finalAmount,
                "Cupom aplicado com sucesso!"
        );
    }

    @GetMapping("/admin/coupons")
    @Transactional(readOnly = true)
    public List<CouponView> listAdminCoupons() {
        return coupons.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(CouponView::from)
                .toList();
    }

    @PostMapping("/admin/coupons")
    @Transactional
    public ResponseEntity<CouponView> createCoupon(@Valid @RequestBody CreateCouponRequest request) {
        String cleanCode = InputSanitizer.sanitizeText(request.code()).toUpperCase().trim();
        if (coupons.existsByCodeIgnoreCase(cleanCode)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um cupom com este código.");
        }

        DiscountCoupon coupon = new DiscountCoupon(
                cleanCode,
                request.discountPercent(),
                request.discountAmount(),
                request.minOrderValue(),
                request.maxUses(),
                request.expiresAt()
        );
        DiscountCoupon saved = coupons.save(coupon);
        return ResponseEntity.status(HttpStatus.CREATED).body(CouponView.from(saved));
    }

    @PatchMapping("/admin/coupons/{id}/toggle")
    @Transactional
    public CouponView toggleCouponActive(@PathVariable Long id) {
        DiscountCoupon coupon = coupons.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cupom não encontrado."));
        coupon.setActive(!coupon.isActive());
        DiscountCoupon saved = coupons.save(coupon);
        return CouponView.from(saved);
    }

    @DeleteMapping("/admin/coupons/{id}")
    @Transactional
    public ResponseEntity<Void> deleteCoupon(@PathVariable Long id) {
        if (!coupons.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cupom não encontrado.");
        }
        coupons.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
