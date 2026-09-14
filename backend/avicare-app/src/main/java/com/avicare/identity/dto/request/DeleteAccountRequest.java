package com.avicare.identity.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * Closing one's own account.
 *
 * @param password the account's own password, retyped. A session token is enough to browse; it is
 *     not enough to destroy.
 */
public record DeleteAccountRequest(@NotBlank String password) {}
