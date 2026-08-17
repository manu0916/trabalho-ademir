package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.StockAlert;
import com.ecommerce.hardware.repository.StockAlertRepository;
import com.ecommerce.hardware.security.InputSanitizer;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
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

            @NotBlank(message = "Tamanho é obrigatório.")
            @Size(max = 20)
            String size,

            @NotBlank(message = "Cor é obrigatória.")
            @Size(max = 80)
            String color,

            @NotBlank(message = "E-mail é obrigatório.")
            @Email(message = "E-mail inválido.")
            @Size(max = 254)
            String email,

            @Size(max = 30)
            String whatsapp
    ) { }

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
        String cleanEmail = InputSanitizer.sanitizeEmail(request.email());
        String cleanName = InputSanitizer.sanitizeText(request.productName());
        String cleanSize = InputSanitizer.sanitizeText(request.size());
        String cleanColor = InputSanitizer.sanitizeText(request.color());
        String cleanWhatsapp = request.whatsapp() != null ? InputSanitizer.sanitizeText(request.whatsapp()) : null;

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
