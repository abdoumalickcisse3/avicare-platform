package com.avicare.identity.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Redeem a reset code and set a new password. */
public record PasswordResetConfirmRequest(
    @NotBlank @Size(max = 30) String phone,
    @NotBlank @Size(min = 6, max = 6) String code,
    @NotBlank @Size(min = 8, max = 100) String newPassword) {}
