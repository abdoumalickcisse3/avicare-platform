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
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * An egg collection on a layer {@link ProductionUnit} for a given date and time-slot (Sprint B2-1).
 * One row per (unit, date, timeslot) — upserted by {@code EggCollectionService}.
 *
 * <p>{@code totalEggs} counts the GOOD (gradable) eggs; {@code brokenEggs} is a SEPARATE count (not
 * included in the total, not graded) — there is no ordering constraint between them. {@code
 * gradesCount} is a JSONB breakdown of the good eggs by grade key, validated in the service against
 * the farm's configured grades. Egg production never touches the unit's head count (a broken egg is
 * not hen mortality); layer mortality stays on {@code daily_records}.
 *
 * <p>The collector and the author are referenced by id ({@code collectorUserId}, {@code createdBy})
 * — no cross-context {@code @ManyToOne} to the identity {@code User}. Timestamps are DB-owned
 * (trigger), mapped read-only.
 */
@Entity
@Table(name = "egg_collections")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class EggCollection {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "production_unit_id", nullable = false)
  private ProductionUnit productionUnit;

  @Column(name = "collection_date", nullable = false)
  private LocalDate collectionDate;

  @Column(name = "timeslot_key", nullable = false)
  private String timeslotKey;

  @Column(name = "total_eggs", nullable = false)
  private int totalEggs = 0;

  @Column(name = "broken_eggs", nullable = false)
  private int brokenEggs = 0;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "grades_count", nullable = false)
  private Map<String, Integer> gradesCount = Map.of();

  @Column(name = "collector_user_id")
  private Long collectorUserId;

  @Column private String notes;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
