package com.avicare.partner.dto.request;

import com.avicare.partner.domain.PartnerType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Create a partner (admin). */
public record CreatePartnerRequest(
    @NotBlank String name,
    @NotNull PartnerType type,
    String contactName,
    String contactPhone,
    String contactEmail,
    String logoUrl) {}
