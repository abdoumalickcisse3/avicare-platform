package com.avicare.identity.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Editable profile fields. Email and role are not user-editable here. */
public record UpdateProfileRequest(
    @NotBlank @Size(max = 200) String fullName,
    @Size(max = 30) String phone,
    @Size(max = 10) String locale) {}
