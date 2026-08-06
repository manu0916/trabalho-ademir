package com.ecommerce.hardware.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AdminLoginRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 12, max = 72) String password
) {
}
