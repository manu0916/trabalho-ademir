package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.StockAlert;
import com.ecommerce.hardware.repository.StockAlertRepository;
import com.ecommerce.hardware.security.InputSanitizer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class StockAlertController {

    private static final Pattern WHATSAPP_INPUT_PATTERN = Pattern.compile("^\\+?[0-9() .\\-]+$");
    private static final Pattern WHATSAPP_DIGITS_PATTERN = Pattern.compile("^\\d{10,15}$");
    private static final Pattern NON_DIGIT_PATTERN = Pattern.compile("[^0-9]");

    private final StockAlertRepository stockAlerts;

    public StockAlertController(StockAlertRepository stockAlerts) {
        this.stockAlerts = stockAlerts;
    }

    public record CreateStockAlertRequest(
            @NotNull(message = "ID do produto é obrigatório.")
            Long productId,

            @NotBlank(message = "Nome do produto é obrigatório.")
            @Size(max = 200)
            String productName,

            @Size(max = 20)
            String size,

            @Size(max = 80)
            String color,

            @Email(message = "E-mail inválido.")
            @Size(max = 254)
            String email,

            @Size(max = 30)
            String whatsapp
    ) {
        @AssertTrue(message = "Informe um e-mail ou WhatsApp para receber o aviso.")
        public boolean isContactChannelProvided() {
            return hasText(email) || normalizeWhatsapp(whatsapp) != null;
        }

        @AssertTrue(message = "WhatsApp inválido.")
        public boolean isWhatsappValid() {
            return !hasText(whatsapp) || normalizeWhatsapp(whatsapp) != null;
        }
    }

    public record StockAlertView(
            Long id,
            Long productId,
            String productName,
            String size,
            String color,
            String email,
            String whatsapp,
            String status,
            Instant createdAt
    ) {
        public static StockAlertView from(StockAlert a) {
            return new StockAlertView(
                    a.getId(),
                    a.getProductId(),
                    a.getProductName(),
                    a.getSize(),
                    a.getColor(),
                    a.getEmail(),
                    a.getWhatsapp(),
                    a.getStatus(),
                    a.getCreatedAt()
            );
        }
    }

    @PostMapping("/stock-alerts")
    public ResponseEntity<StockAlertView> createAlert(@Valid @RequestBody CreateStockAlertRequest request) {
        String cleanEmail = normalizeOptionalEmail(request.email());
        String cleanName = InputSanitizer.sanitizeText(request.productName());
        String cleanSize = normalizeOptionalText(request.size());
        String cleanColor = normalizeOptionalText(request.color());
        String cleanWhatsapp = normalizeWhatsapp(request.whatsapp());

        if (!hasText(cleanName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nome do produto é obrigatório.");
        }
        if (!hasText(cleanEmail) && cleanWhatsapp == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Informe um e-mail ou WhatsApp para receber o aviso."
            );
        }

        StockAlert alert = new StockAlert(
                request.productId(),
                cleanName,
                cleanSize,
                cleanColor,
                cleanEmail,
                cleanWhatsapp
        );
        StockAlert saved = stockAlerts.save(alert);
        return ResponseEntity.status(HttpStatus.CREATED).body(StockAlertView.from(saved));
    }

    private static String normalizeOptionalText(String value) {
        String sanitized = InputSanitizer.sanitizeText(value);
        return sanitized == null ? "" : sanitized;
    }

    private static String normalizeOptionalEmail(String value) {
        String sanitized = InputSanitizer.sanitizeEmail(value);
        return sanitized == null ? "" : sanitized;
    }

    private static String normalizeWhatsapp(String value) {
        if (!hasText(value)) {
            return null;
        }

        String trimmed = value.trim();
        if (!WHATSAPP_INPUT_PATTERN.matcher(trimmed).matches()) {
            return null;
        }

        String digits = NON_DIGIT_PATTERN.matcher(trimmed).replaceAll("");
        return WHATSAPP_DIGITS_PATTERN.matcher(digits).matches() ? digits : null;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    @GetMapping("/admin/stock-alerts")
    @Transactional(readOnly = true)
    public List<StockAlertView> listAdminAlerts() {
        return stockAlerts.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(StockAlertView::from)
                .toList();
    }

    @PatchMapping("/admin/stock-alerts/{id}/notify")
    @Transactional
    public StockAlertView markNotified(@PathVariable Long id) {
        StockAlert alert = stockAlerts.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Alerta de estoque não encontrado."));
        alert.setStatus("NOTIFIED");
        StockAlert saved = stockAlerts.save(alert);
        return StockAlertView.from(saved);
    }
}
