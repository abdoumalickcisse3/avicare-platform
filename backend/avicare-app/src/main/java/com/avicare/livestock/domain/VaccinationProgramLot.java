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
import java.time.LocalDateTime;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * The vaccination program assigned to a {@link ProductionUnit} (Sprint B3-2). At most one per unit
 * (unique join column). {@code programKey} references the catalog (category {@code
 * vaccination_programs}) by key. {@code scheduleOverrides} carries per-lot customizations (skip /
 * custom dates) — stored here, applied from B3-3+. Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "vaccination_programs_lot")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class VaccinationProgramLot {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "production_unit_id", nullable = false, unique = true)
  private ProductionUnit productionUnit;

  @Column(name = "program_key", nullable = false)
  private String programKey;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "schedule_overrides")
  private Map<String, Object> scheduleOverrides;

  @Column(name = "assigned_by")
  private Long assignedBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
