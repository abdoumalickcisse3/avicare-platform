package com.avicare.partner.dto.response;

import com.avicare.partner.domain.PartnerUser;

/** {@code temporaryPassword} is returned ONCE at creation, never stored in clear. */
public record PartnerUserResponse(
    Long id,
    Long partnerId,
    String email,
    String fullName,
    boolean active,
    String temporaryPassword) {

  public static PartnerUserResponse of(PartnerUser u, String temporaryPassword) {
    return new PartnerUserResponse(
        u.getId(),
        u.getPartnerId(),
        u.getEmail(),
        u.getFullName(),
        u.isActive(),
        temporaryPassword);
  }
}
