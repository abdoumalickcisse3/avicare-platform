package com.avicare.identity.domain;

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
 * DB source of truth for an issued JWT refresh token. Revocation is recorded via {@code revokedAt}
 * (Redis caches active revocations for fast lookup — handled at the service layer in a later A3
 * session). The owning user is referenced by id, not a JPA association, per the project's
 * reference-by-id rule.
 */
@Entity
@Table(name = "refresh_tokens")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class RefreshToken {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  /** Opaque token value — never logged. Excluded from {@code toString()} on purpose. */
  @ToString.Exclude
  @Column(nullable = false, unique = true)
  private String token;

  @Column(name = "expires_at", nullable = false)
  private LocalDateTime expiresAt;

  @Column(name = "revoked_at")
  private LocalDateTime revokedAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;
}
