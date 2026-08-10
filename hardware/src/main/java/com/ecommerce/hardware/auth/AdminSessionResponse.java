package com.ecommerce.hardware.auth;

public record AdminSessionResponse(String email, String accessToken, long expiresAtEpochSeconds) {

    public AdminSessionResponse(String email) {
        this(email, null, 0);
    }
}
