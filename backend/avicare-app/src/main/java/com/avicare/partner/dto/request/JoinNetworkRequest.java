package com.avicare.partner.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Farmer joins a partner network via an invite code. */
public record JoinNetworkRequest(@NotBlank String code) {}
