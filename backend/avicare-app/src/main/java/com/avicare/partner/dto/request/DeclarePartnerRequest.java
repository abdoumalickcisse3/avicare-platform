package com.avicare.partner.dto.request;

import jakarta.validation.constraints.NotNull;

/** Farmer declares an existing partner as their supplier/vet. */
public record DeclarePartnerRequest(@NotNull Long partnerId) {}
