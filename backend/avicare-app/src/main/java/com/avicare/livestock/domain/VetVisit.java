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
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A veterinary visit on a {@link ProductionUnit} (Sprint B3-3). The veterinarian is optional (an
 * anonymous visit is allowed). Carries the diagnosis, recommendations, optional cost and a
 * follow-up flag + date (feeds future in-app alerts). Timestamps DB-owned (trigger).
 */
@Entity
@Table(name = "vet_visits")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class VetVisit {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "production_unit_id", nullable = false)
  private ProductionUnit productionUnit;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "veterinarian_id")
  private Veterinarian veterinarian;

  @Column(name = "visit_date", nullable = false)
  private LocalDate visitDate;

  @Column(nullable = false)
  private String reason;

  @Column private String diagnosis;

  @Column private String recommendations;

  @Column(name = "cost_xof")
  private Integer costXof;

  @Column(name = "follow_up_needed", nullable = false)
  private boolean followUpNeeded = false;

  @Column(name = "follow_up_date")
  private LocalDate followUpDate;

  @Column private String notes;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
