package com.ecommerce.hardware.auth;

/**
 * Stateless credential exchange used by trusted browser-extension clients.
 * No administrator session or CSRF cookie is created by this flow.
 */
public record AdminTokenResponse(String accessToken, long expiresAtEpochSeconds) {
}
