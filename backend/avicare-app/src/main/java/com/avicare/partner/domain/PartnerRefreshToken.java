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

/** Source of truth for partner sessions. Revocation via {@code revokedAt}. */
@Entity
@Table(name = "partner_refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "token")
public class PartnerRefreshToken {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "partner_user_id", nullable = false)
  private Long partnerUserId;

  @Column(nullable = false, unique = true)
  private String token;

  @Column(name = "expires_at", nullable = false)
  private LocalDateTime expiresAt;

  @Column(name = "revoked_at")
  private LocalDateTime revokedAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;
}
