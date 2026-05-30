package com.avicare.tenancy.domain;

import com.avicare.common.security.principal.FarmRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Effective membership of a user in a farm: the tenant-level {@link FarmRole} plus per-membership
 * permission overrides stored as a JSONB array of {@code resource:verb} strings. User and farm are
 * referenced by id. One row per (user, farm).
 */
@Entity
@Table(
    name = "user_farms",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "farm_id"}))
@Getter
@Setter
@NoArgsConstructor
@ToString
public class UserFarm {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private FarmRole role;

  /** JSONB array of {@code resource:verb} grants; defaults to the role's baseline at assignment. */
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private List<String> permissions = new ArrayList<>();

  @Column(name = "invited_by")
  private Long invitedBy;

  @Column(name = "joined_at", insertable = false, updatable = false)
  private LocalDateTime joinedAt;

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
