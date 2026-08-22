package com.avicare.partner.dto.response;

import com.avicare.partner.domain.PartnerInviteCode;
import java.time.LocalDateTime;

/** Invite code as returned by the API. */
public record InviteCodeResponse(
    Long id,
    Long partnerId,
    String code,
    boolean active,
    Integer maxUses,
    int usesCount,
    LocalDateTime expiresAt) {

  public static InviteCodeResponse of(PartnerInviteCode c) {
    return new InviteCodeResponse(
        c.getId(),
        c.getPartnerId(),
        c.getCode(),
        c.isActive(),
        c.getMaxUses(),
        c.getUsesCount(),
        c.getExpiresAt());
  }
}
