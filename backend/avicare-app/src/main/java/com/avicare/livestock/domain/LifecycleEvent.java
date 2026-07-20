package com.avicare.livestock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A generic event on a {@link ProductionUnit} (creation, transfer, mortality, count adjustment...).
 * {@code quantityDelta} adjusts the unit's count (negative on mortality). The production unit is
 * referenced by id; {@code details} is a free-form JSONB payload. Events are append-only (no {@code
 * updated_at}).
 */
@Entity
@Table(name = "lifecycle_events")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class LifecycleEvent {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "production_unit_id", nullable = false)
  private Long productionUnitId;

  @Column(name = "event_type", nullable = false)
  private String eventType;

  @Column(name = "occurred_at", insertable = false, updatable = false)
  private LocalDateTime occurredAt;

  @Column(name = "quantity_delta", nullable = false)
  private int quantityDelta = 0;

  @Column private String reason;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private Map<String, Object> details = Map.of();

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  /**
   * Mobile replay key (doc 08 §9): when set, a retry with the same value returns the original row
   * instead of applying the delta again. NULL for web-originated events (partial unique index).
   */
  @Column(name = "client_ref")
  private UUID clientRef;
}
