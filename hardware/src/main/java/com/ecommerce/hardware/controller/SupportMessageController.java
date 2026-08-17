package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.SupportMessage;
import com.ecommerce.hardware.repository.SupportMessageRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
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
public class SupportMessageController {

    private final SupportMessageRepository supportMessages;

    public SupportMessageController(SupportMessageRepository supportMessages) {
        this.supportMessages = supportMessages;
    }

    public record CreateMessageRequest(
            @NotBlank(message = "O nome é obrigatório.")
            @Size(max = 160, message = "Nome muito longo.")
            String fullName,

            @NotBlank(message = "O e-mail é obrigatório.")
            @Email(message = "E-mail inválido.")
            @Size(max = 254, message = "E-mail muito longo.")
            String email,

            @NotBlank(message = "O assunto é obrigatório.")
            @Size(max = 200, message = "Assunto muito longo.")
            String subject,

            @NotBlank(message = "A mensagem é obrigatória.")
            @Size(max = 4000, message = "Mensagem muito longa.")
            String message
    ) { }

    public record UpdateStatusRequest(
            @NotBlank(message = "Status é obrigatório.")
            @Size(max = 20)
            String status
    ) { }

    public record SupportMessageResponse(
            Long id,
            String fullName,
            String email,
            String subject,
            String message,
            String status,
            Instant createdAt
    ) {
        public static SupportMessageResponse from(SupportMessage msg) {
            return new SupportMessageResponse(
                    msg.getId(),
                    msg.getFullName(),
                    msg.getEmail(),
                    msg.getSubject(),
                    msg.getMessage(),
                    msg.getStatus(),
                    msg.getCreatedAt()
            );
        }
    }

    @PostMapping("/support/messages")
    public ResponseEntity<SupportMessageResponse> sendMessage(@Valid @RequestBody CreateMessageRequest request) {
        String cleanFullName = com.ecommerce.hardware.security.InputSanitizer.sanitizeText(request.fullName());
        String cleanEmail = com.ecommerce.hardware.security.InputSanitizer.sanitizeEmail(request.email());
        String cleanSubject = com.ecommerce.hardware.security.InputSanitizer.sanitizeText(request.subject());
        String cleanMessage = com.ecommerce.hardware.security.InputSanitizer.sanitizeText(request.message());

        if (cleanFullName == null || cleanFullName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O nome informado é inválido.");
        }
        if (cleanEmail == null || cleanEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O e-mail informado é inválido.");
        }
        if (cleanSubject == null || cleanSubject.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O assunto informado é inválido.");
        }
        if (cleanMessage == null || cleanMessage.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A mensagem informada é inválida.");
        }

        SupportMessage message = new SupportMessage(
                cleanFullName,
                cleanEmail,
                cleanSubject,
                cleanMessage
        );
        SupportMessage saved = supportMessages.save(message);
        return ResponseEntity.status(HttpStatus.CREATED).body(SupportMessageResponse.from(saved));
    }

    @GetMapping("/admin/support/messages")
    @Transactional(readOnly = true)
    public List<SupportMessageResponse> listAdminMessages() {
        return supportMessages.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(SupportMessageResponse::from)
                .toList();
    }

    @PatchMapping("/admin/support/messages/{id}/status")
    @Transactional
    public SupportMessageResponse updateMessageStatus(@PathVariable Long id,
                                                      @Valid @RequestBody UpdateStatusRequest request) {
        SupportMessage message = supportMessages.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mensagem não encontrada."));

        String nextStatus = "ANSWERED".equalsIgnoreCase(request.status()) ? "ANSWERED" : "PENDING";
        message.setStatus(nextStatus);
        SupportMessage updated = supportMessages.save(message);
        return SupportMessageResponse.from(updated);
    }
}
