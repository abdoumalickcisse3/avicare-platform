package com.avicare.partner.dto.response;

import com.avicare.partner.domain.Partner;

/** Partner as returned by the API. */
public record PartnerResponse(
    Long id,
    String name,
    String type,
    String contactName,
    String contactPhone,
    String contactEmail,
    String logoUrl,
    String status) {

  public static PartnerResponse of(Partner p) {
    return new PartnerResponse(
        p.getId(),
        p.getName(),
        p.getType().name(),
        p.getContactName(),
        p.getContactPhone(),
        p.getContactEmail(),
        p.getLogoUrl(),
        p.getStatus().name());
  }
}
