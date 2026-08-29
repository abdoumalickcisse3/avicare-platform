package com.avicare.identity.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Ask for a WhatsApp reset code. The phone is matched on digits only. */
public record PasswordResetRequest(@NotBlank @Size(max = 30) String phone) {}
