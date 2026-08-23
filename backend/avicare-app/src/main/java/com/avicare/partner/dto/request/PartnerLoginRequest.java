package com.avicare.partner.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** Partner-portal login credentials. */
public record PartnerLoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
