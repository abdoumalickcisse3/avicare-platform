package com.avicare.identity.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Refresh-token exchange payload. The refresh token travels in the body (mobile/Bearer-first). */
public record RefreshRequest(@NotBlank String refreshToken) {}
