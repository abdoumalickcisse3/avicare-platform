package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrimaryKeyJoinColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A broiler (poultry chair) batch — the first concrete species extension of {@link ProductionUnit}
 * (JPA JOINED inheritance, joins on {@code id}). Adds the breed, the slaughter targets and the
 * initial head count; the species-agnostic fields (farm, status, current count, dates...) live on
 * the parent {@code production_units} row.
 *
 * <p>{@code breed} is mapped to the NOT NULL {@code poultry_batches.breed_id}; the service also
 * sets the parent's nullable {@code breedId} to the same value so the transverse {@code
 * ProductionUnitResponse} stays consistent.
 */
@Entity
@Table(name = "poultry_batches")
@PrimaryKeyJoinColumn(name = "id")
@Getter
@Setter
@NoArgsConstructor
public class PoultryBatch extends ProductionUnit {

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "breed_id", nullable = false)
  private Breed breed;

  @Column(name = "target_weight_g")
  private Integer targetWeightG;

  @Column(name = "target_age_days")
  private Integer targetAgeDays;

  @Column(name = "initial_count", nullable = false)
  private int initialCount;
}
