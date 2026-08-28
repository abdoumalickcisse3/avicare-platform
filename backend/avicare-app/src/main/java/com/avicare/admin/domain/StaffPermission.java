package com.avicare.admin.domain;

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
 * One permission granted to a member of the platform staff (super-admin console, Phase 0).
 *
 * <p>{@code userId} and {@code grantedBy} are bare id references. Timestamps are DB-owned
 * (trigger). No soft delete: a permission is revoked, not archived.
 *
 * <p>The permission string belongs to the STAFF taxonomy ({@code StaffPermissionCatalog}), which is
 * disjoint from the farm one — a farm permission stored here would not validate.
 */
@Entity
@Table(name = "staff_permissions")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class StaffPermission {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(nullable = false)
  private String permission;

  @Column(name = "granted_by")
  private Long grantedBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
