package com.avicare.partner.dto.response;

import com.avicare.partner.domain.Partner;

/** A selectable partner in the farmer-facing directory. No internal fields (createdBy, status). */
public record AvailablePartnerResponse(
    Long id, String name, String type, String contactName, String contactPhone, String logoUrl) {

  public static AvailablePartnerResponse of(Partner p) {
    return new AvailablePartnerResponse(
        p.getId(),
        p.getName(),
        p.getType().name(),
        p.getContactName(),
        p.getContactPhone(),
        p.getLogoUrl());
  }
}
