package com.avicare.partner.dto.response;

import com.avicare.partner.domain.Partner;

/** The signed-in partner's own profile + network size. */
public record PartnerProfileResponse(
    Long partnerId, String name, String type, String logoUrl, int farmCount) {

  public static PartnerProfileResponse of(Partner p, int farmCount) {
    return new PartnerProfileResponse(
        p.getId(), p.getName(), p.getType().name(), p.getLogoUrl(), farmCount);
  }
}
