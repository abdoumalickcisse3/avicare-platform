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

/**
 * A one-time password-reset code sent over WhatsApp.
 *
 * <p>{@code codeHash} is a BCrypt digest, never the code. Six digits is only a million
 * combinations, so a SHA-256 would be reversed instantly from a database leak; BCrypt puts that
 * search far beyond the code's own lifetime.
 */
@Entity
@Table(name = "password_reset_codes")
@Getter
@Setter
@NoArgsConstructor
public class PasswordResetCode {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "code_hash", nullable = false)
  private String codeHash;

  @Column(name = "expires_at", nullable = false)
  private LocalDateTime expiresAt;

  @Column(name = "consumed_at")
  private LocalDateTime consumedAt;

  @Column(nullable = false)
  private int attempts = 0;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  /** Usable when not yet consumed, not expired, and not burnt through its attempt budget. */
  public boolean isUsable(int maxAttempts) {
    return consumedAt == null && attempts < maxAttempts && expiresAt.isAfter(LocalDateTime.now());
  }
}
