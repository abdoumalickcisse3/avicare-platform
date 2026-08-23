package com.avicare.partner.dto.response;

/** Partner-portal token pair returned by login/refresh. */
public record PartnerAuthTokens(String accessToken, String refreshToken, long expiresIn) {}
