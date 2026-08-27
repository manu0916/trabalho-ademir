package com.ecommerce.hardware.config;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.Locale;

@Validated
@ConfigurationProperties(prefix = "app.admin")
public class AdminProperties {

    @Email
    @Size(max = 254)
    private String email = "";

    @Pattern(regexp = "^$|^\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}$",
            message = "must be blank or a bcrypt hash")
    private String passwordHash = "";

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email == null ? "" : email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash == null ? "" : passwordHash;
    }

    public String normalizedEmail() {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
