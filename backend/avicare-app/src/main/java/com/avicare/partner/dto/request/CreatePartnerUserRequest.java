package com.avicare.partner.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/** ADMIN provisions a partner-portal login account. */
public record CreatePartnerUserRequest(@NotBlank @Email String email, String fullName) {}
