package com.avicare.integrity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One inconsistency found by the nightly checks.
 *
 * <p>A finding is a claim about one entity, and it stays a single row for as long as it is true:
 * the sweep updates {@code lastSeenAt} rather than inserting again, so a defect nobody has fixed
 * does not fill the console with a copy per night. It closes either because someone acted on it or
 * because the condition came back to normal on its own.
 */
@Entity
@Table(name = "integrity_findings")
@Getter
@Setter
@NoArgsConstructor
public class IntegrityFinding {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "check_key", nullable = false, updatable = false)
  private String checkKey;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Severity severity;

  @Column(name = "entity_type", nullable = false, updatable = false)
  private String entityType;

  @Column(name = "entity_id", nullable = false, updatable = false)
  private Long entityId;

  @Column(name = "farm_id")
  private Long farmId;

  @Column(name = "expected_value")
  private String expectedValue;

  @Column(name = "actual_value")
  private String actualValue;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private Map<String, Object> details = Map.of();

  @Column(name = "detected_at", insertable = false, updatable = false)
  private LocalDateTime detectedAt;

  @Column(name = "last_seen_at", nullable = false)
  private LocalDateTime lastSeenAt = LocalDateTime.now();

  /** When the on-call was told. Set once, so the same defect does not wake anyone twice. */
  @Column(name = "notified_at")
  private LocalDateTime notifiedAt;

  @Column(name = "resolved_at")
  private LocalDateTime resolvedAt;

  @Column(name = "resolved_by")
  private Long resolvedBy;

  @Column(name = "resolution_action")
  private String resolutionAction;

  @Column(name = "resolution_notes")
  private String resolutionNotes;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  public boolean isOpen() {
    return resolvedAt == null;
  }

  /** Close it, saying who and how. The database refuses a resolution with no action. */
  public void resolve(String action, Long userId, String notes) {
    this.resolvedAt = LocalDateTime.now();
    this.resolutionAction = action;
    this.resolvedBy = userId;
    this.resolutionNotes = notes;
  }
}
