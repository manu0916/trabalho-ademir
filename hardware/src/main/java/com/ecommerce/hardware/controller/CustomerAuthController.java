package com.ecommerce.hardware.controller;

import com.ecommerce.hardware.model.CustomerAccount;
import com.ecommerce.hardware.repository.CustomerAccountRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/customer/auth")
public class CustomerAuthController {

    static final String CUSTOMER_ID_SESSION_KEY = "customerId";
    static final String CUSTOMER_USERNAME_SESSION_KEY = "customerUsername";

    private final CustomerAccountRepository customerAccountRepository;
    private final PasswordEncoder passwordEncoder;

    public CustomerAuthController(CustomerAccountRepository customerAccountRepository, PasswordEncoder passwordEncoder) {
        this.customerAccountRepository = customerAccountRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/register")
    public ResponseEntity<CustomerSessionResponse> register(@RequestBody CustomerCredentials credentials,
                                                            HttpSession session) {
        String username = normalizeUsername(credentials.username());
        validatePassword(credentials.password());

        if (customerAccountRepository.existsByUsernameIgnoreCase(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este usuário já está em uso.");
        }

        try {
            CustomerAccount account = customerAccountRepository.saveAndFlush(
                    new CustomerAccount(username, passwordEncoder.encode(credentials.password())));
            startSession(session, account);
            return ResponseEntity.status(HttpStatus.CREATED).body(new CustomerSessionResponse(account.getUsername()));
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este usuário já está em uso.");
        }
    }

    @PostMapping("/login")
    public CustomerSessionResponse login(@RequestBody CustomerCredentials credentials, HttpSession session) {
        String username = normalizeUsername(credentials.username());
        CustomerAccount account = customerAccountRepository.findByUsernameIgnoreCase(username)
                .filter(foundAccount -> passwordEncoder.matches(credentials.password(), foundAccount.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário ou senha inválidos."));

        startSession(session, account);
        return new CustomerSessionResponse(account.getUsername());
    }

    @GetMapping("/session")
    public ResponseEntity<CustomerSessionResponse> session(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return ResponseEntity.noContent().build();
        }
        String username = (String) session.getAttribute(CUSTOMER_USERNAME_SESSION_KEY);
        if (username == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(new CustomerSessionResponse(username));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.noContent().build();
    }

    private void startSession(HttpSession session, CustomerAccount account) {
        session.setAttribute(CUSTOMER_ID_SESSION_KEY, account.getId());
        session.setAttribute(CUSTOMER_USERNAME_SESSION_KEY, account.getUsername());
    }

    private String normalizeUsername(String username) {
        if (username == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um usuário.");
        }
        String normalized = username.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[a-z0-9._-]{3,40}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "O usuário deve ter de 3 a 40 caracteres: letras, números, ponto, hífen ou _. ");
        }
        return normalized;
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 6 || password.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A senha deve ter entre 6 e 100 caracteres.");
        }
    }

    public record CustomerCredentials(String username, String password) {
    }

    public record CustomerSessionResponse(String username) {
    }
}
