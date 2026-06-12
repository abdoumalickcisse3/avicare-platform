package com.avicare.livestock.domain;

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
 * A veterinarian in a farm's directory (Sprint B3-3, health.advanced). Farm-scoped — the farm is
 * referenced by id (no cross-context {@code @ManyToOne} to tenancy). Soft-deleted via {@code
 * active=false}. Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "veterinarians")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class Veterinarian {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "full_name", nullable = false)
  private String fullName;

  @Column private String phone;

  @Column private String email;

  @Column private String speciality;

  @Column(name = "license_number")
  private String licenseNumber;

  @Column private String location;

  @Column private String notes;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
