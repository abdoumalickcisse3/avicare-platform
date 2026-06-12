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
 * A treatment administered on a {@link ProductionUnit} over a period (Sprint B3-3). {@code
 * treatmentKey} references the platform catalog (category {@code treatments}). The withdrawal days
 * are a SNAPSHOT taken at record time (frozen against later catalog changes); {@code endDate} and
 * the {@code withdrawalEndDate*} are computed in the service. Withdrawal is exposed, never
 * enforced.
 */
@Entity
@Table(name = "treatments_executed")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class TreatmentExecuted {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "production_unit_id", nullable = false)
  private ProductionUnit productionUnit;

  @Column(name = "treatment_key", nullable = false)
  private String treatmentKey;

  @Column(name = "start_date", nullable = false)
  private LocalDate startDate;

  @Column(name = "duration_days", nullable = false)
  private int durationDays;

  @Column(name = "end_date", nullable = false)
  private LocalDate endDate;

  @Column(name = "dose_amount", nullable = false)
  private BigDecimal doseAmount;

  @Column(name = "dose_unit", nullable = false)
  private String doseUnit;

  @Column(nullable = false)
  private String route;

  @Column(name = "subjects_count", nullable = false)
  private int subjectsCount;

  @Column private String reason;

  @Column(name = "prescribed_by")
  private String prescribedBy;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "veterinarian_id")
  private Veterinarian veterinarian;

  @Column(name = "withdrawal_days_meat")
  private Integer withdrawalDaysMeat;

  @Column(name = "withdrawal_days_eggs")
  private Integer withdrawalDaysEggs;

  @Column(name = "withdrawal_end_date_meat")
  private LocalDate withdrawalEndDateMeat;

  @Column(name = "withdrawal_end_date_eggs")
  private LocalDate withdrawalEndDateEggs;

  @Column private String notes;

  @Column(name = "administered_by_user_id")
  private Long administeredByUserId;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
