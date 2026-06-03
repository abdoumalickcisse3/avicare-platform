package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Inheritance;
import jakarta.persistence.InheritanceType;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * Pivot abstraction for every species (Décision 5). Concrete species units (e.g. {@code
 * PoultryBatch} in Sprint B1) extend this with JPA {@link InheritanceType#JOINED} inheritance,
 * adding their own table that joins on {@code id} — the parent {@code production_units} table and
 * the transverse contexts (health, commercial, inventory...) never change when a species is added.
 *
 * <p>Concrete and queryable on its own (transverse contexts read/operate on units
 * species-agnostically). Species subclasses add their own JOINED table that joins on {@code id}
 * without changing this parent. The farm and breed are referenced by id. Soft-deletable; timestamps
 * are DB-owned (trigger) and mapped read-only.
 */
@Entity
@Table(name = "production_units")
@Inheritance(strategy = InheritanceType.JOINED)
@SQLDelete(sql = "UPDATE production_units SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class ProductionUnit {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Species species;

  @Enumerated(EnumType.STRING)
  @Column(name = "unit_kind", nullable = false)
  private UnitKind unitKind;

  @Column(name = "breed_id")
  private Long breedId;

  @Column private String name;

  @Column(name = "start_date", nullable = false)
  private LocalDate startDate;

  @Column(name = "end_date")
  private LocalDate endDate;

  @Column(name = "current_count", nullable = false)
  private int currentCount = 1;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private UnitStatus status = UnitStatus.ACTIVE;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "deleted_at")
  private LocalDateTime deletedAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
