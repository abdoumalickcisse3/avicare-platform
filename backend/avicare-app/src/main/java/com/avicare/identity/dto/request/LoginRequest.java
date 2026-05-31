package com.avicare.identity.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Login payload. */
public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
