package com.ecommerce.hardware.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "customer_accounts")
public class CustomerAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String username;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "full_name", length = 160)
    private String fullName;

    @Column(length = 254)
    private String email;

    /**
     * The CPF is never returned by the account API after it has been stored. Access to this
     * column is restricted to the backend database role by the production schema's RLS/revokes.
     */
    @Column(length = 11)
    private String cpf;

    @Column(name = "profile_updated_at")
    private Instant profileUpdatedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected CustomerAccount() {
    }

    public CustomerAccount(String username, String passwordHash) {
        this.username = username;
        this.passwordHash = passwordHash;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void updateProfile(String fullName, String email, String cpf) {
        this.fullName = fullName;
        this.email = email;
        if (cpf != null && !cpf.isBlank()) this.cpf = cpf;
        this.profileUpdatedAt = Instant.now();
    }

    public boolean hasCompleteProfile() {
        return fullName != null && !fullName.isBlank()
                && email != null && !email.isBlank()
                && cpf != null && cpf.length() == 11;
    }

    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getCpf() { return cpf; }
    public Instant getProfileUpdatedAt() { return profileUpdatedAt; }
}
