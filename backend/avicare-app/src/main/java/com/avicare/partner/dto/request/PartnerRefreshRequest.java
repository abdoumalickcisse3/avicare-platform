package com.avicare.partner.dto.request;

import jakarta.validation.constraints.NotBlank;

/** A partner refresh/logout request body. */
public record PartnerRefreshRequest(@NotBlank String refreshToken) {}
