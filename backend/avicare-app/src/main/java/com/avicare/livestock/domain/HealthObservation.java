package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A free-form health observation on a {@link ProductionUnit} (Sprint B3-2): a dated note with a
 * {@link Severity} level, an optional suspected disease and an observer (by id). Timestamps
 * DB-owned (trigger).
 */
@Entity
@Table(name = "health_observations")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class HealthObservation {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "production_unit_id", nullable = false)
  private ProductionUnit productionUnit;

  @Column(name = "observation_date", nullable = false)
  private LocalDate observationDate;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Severity severity = Severity.NORMAL;

  @Column(nullable = false)
  private String title;

  @Column private String description;

  @Column(name = "suspected_disease")
  private String suspectedDisease;

  @Column(name = "observed_by_user_id")
  private Long observedByUserId;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
