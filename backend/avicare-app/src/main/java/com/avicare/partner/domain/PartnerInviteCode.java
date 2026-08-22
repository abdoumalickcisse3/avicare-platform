package com.avicare.partner.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A distributable network invite code for a partner. A farm joining via a code creates a {@link
 * PartnerFarmMembership} with origin {@code INVITE_CODE}. {@code maxUses} null = unlimited.
 */
@Entity
@Table(name = "partner_invite_codes")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class PartnerInviteCode {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "partner_id", nullable = false)
  private Long partnerId;

  @Column(nullable = false, unique = true)
  private String code;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "max_uses")
  private Integer maxUses;

  @Column(name = "uses_count", nullable = false)
  private int usesCount = 0;

  @Column(name = "expires_at")
  private LocalDateTime expiresAt;

  @Column(name = "created_by", nullable = false)
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
