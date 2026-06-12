package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * One administration of a vaccine on a {@link ProductionUnit} at a date (Sprint B3-2). One row per
 * (unit, vaccine_key, date). {@code vaccineKey} references the platform catalog (category {@code
 * vaccines}) by key — no cross-catalog SQL FK. The administering user and author are referenced by
 * id (no cross-context {@code @ManyToOne} to identity). Timestamps are DB-owned (trigger).
 */
@Entity
@Table(name = "vaccinations")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class Vaccination {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "production_unit_id", nullable = false)
  private ProductionUnit productionUnit;

  @Column(name = "vaccine_key", nullable = false)
  private String vaccineKey;

  @Column(name = "administered_date", nullable = false)
  private LocalDate administeredDate;

  @Column private String route;

  @Column(name = "dose_per_subject")
  private BigDecimal dosePerSubject;

  @Column(name = "dose_unit")
  private String doseUnit;

  @Column(name = "subjects_count", nullable = false)
  private int subjectsCount;

  @Column(name = "vaccine_batch_number")
  private String vaccineBatchNumber;

  @Column(name = "vaccine_expiry_date")
  private LocalDate vaccineExpiryDate;

  @Column(name = "administered_by_user_id")
  private Long administeredByUserId;

  @Column private String notes;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
