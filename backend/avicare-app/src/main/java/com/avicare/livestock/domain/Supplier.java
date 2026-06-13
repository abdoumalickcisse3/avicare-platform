package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A supplier in a farm's directory (Sprint B4-1). Farm-scoped — the farm is referenced by id (no
 * cross-context {@code @ManyToOne} to tenancy). {@code types} is a free-form list of tags (FEED /
 * MEDICATION / EQUIPMENT / MIXED...), stored as a JSONB array to match the house mapping pattern.
 * Soft-deleted via {@code active=false}. Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "suppliers")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class Supplier {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "commercial_name", nullable = false)
  private String commercialName;

  @Column(name = "contact_person")
  private String contactPerson;

  @Column private String phone;

  @Column private String email;

  @Column private String address;

  @Column private String city;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private List<String> types = List.of();

  @Column(name = "payment_terms")
  private String paymentTerms;

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
