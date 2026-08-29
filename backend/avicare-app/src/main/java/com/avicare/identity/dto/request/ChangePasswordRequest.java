package com.avicare.identity.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Change your own password, knowing the current one.
 *
 * <p>The current password is required even though the caller is authenticated: a token left behind
 * on an unlocked machine must not be enough to take the account over for good.
 */
public record ChangePasswordRequest(
    @NotBlank String currentPassword, @NotBlank @Size(min = 8, max = 100) String newPassword) {}
