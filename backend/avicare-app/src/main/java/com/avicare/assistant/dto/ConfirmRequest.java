package com.avicare.assistant.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of {@code POST /assistant/confirm}: the claim id returned with a DRAFT. */
public record ConfirmRequest(@NotBlank String claimId) {}
