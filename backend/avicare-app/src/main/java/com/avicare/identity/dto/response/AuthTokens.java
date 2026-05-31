package com.avicare.identity.dto.response;

/**
 * Token pair returned by signup/login/refresh.
 *
 * @param accessToken short-lived RSA-signed JWT for the {@code Authorization: Bearer} header
 * @param refreshToken long-lived token to exchange at {@code /auth/refresh}
 * @param expiresIn access-token validity in seconds
 */
public record AuthTokens(String accessToken, String refreshToken, long expiresIn) {}
