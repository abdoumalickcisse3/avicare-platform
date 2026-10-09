package com.avicare.identity.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Sign-up payload. Creates a platform USER account.
 *
 * <p>{@code phone} is required since 2026-10-09. Eleven of the thirty live accounts carry none, and
 * {@code OutboxEnqueuerImpl} skips a recipient whose number is null — so those eleven people have
 * never received a single WhatsApp alert and were never told. An account without a number is an
 * account the platform cannot reach when a flock is dying.
 */
public record SignupRequest(
    @NotBlank @Email @Size(max = 255) String email,
    @NotBlank @Size(min = 8, max = 100) String password,
    @NotBlank @Size(max = 200) String fullName,
    @NotBlank @Size(max = 30) String phone) {}
