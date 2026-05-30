package com.avicare.identity.domain;

import com.avicare.common.security.principal.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * Platform account. Carries authentication material, profile, and the platform-level {@link
 * UserRole}. Tenant-level authority lives on {@link com.avicare.tenancy.domain.UserFarm}
 * memberships, not here.
 *
 * <p>{@code createdAt}/{@code updatedAt} are owned by the database (column {@code DEFAULT NOW()}
 * and the {@code trg_users_updated_at} trigger), so they are mapped read-only and populated on
 * reload.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class User {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true)
  private String email;

  /** BCrypt hash — never logged. Excluded from {@code toString()} on purpose. */
  @ToString.Exclude
  @Column(name = "password_hash", nullable = false)
  private String passwordHash;

  @Column(name = "full_name", nullable = false)
  private String fullName;

  @Column private String phone;

  @Column(name = "avatar_url")
  private String avatarUrl;

  @Column(nullable = false)
  private String locale = "fr";

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private UserRole role = UserRole.USER;

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @Column(name = "email_verified_at")
  private LocalDateTime emailVerifiedAt;

  @Column(name = "last_login_at")
  private LocalDateTime lastLoginAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
