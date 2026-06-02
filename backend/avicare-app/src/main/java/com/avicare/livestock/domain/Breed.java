package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A breed/strain reference for a species. {@code farmId == null} is a platform breed (optionally
 * linked to a catalog item); a non-null farm id is a farm-custom breed. Referenced by id from
 * {@link ProductionUnit}.
 */
@Entity
@Table(
    name = "breeds",
    uniqueConstraints = @UniqueConstraint(columnNames = {"species", "code", "farm_id"}))
@Getter
@Setter
@NoArgsConstructor
@ToString
public class Breed {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Species species;

  @Column(name = "code", nullable = false)
  private String code;

  @Column(nullable = false)
  private String name;

  @Column(name = "catalog_item_id")
  private Long catalogItemId;

  @Column(name = "farm_id")
  private Long farmId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "growth_curve")
  private Map<String, Object> growthCurve;

  @Column(name = "is_active", nullable = false)
  private boolean active = true;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
