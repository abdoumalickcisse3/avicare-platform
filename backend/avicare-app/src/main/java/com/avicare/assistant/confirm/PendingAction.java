package com.avicare.assistant.confirm;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * A short-lived server-side confirm claim (V32): a write DRAFT the assistant prepared, awaiting a
 * {@code POST /assistant/confirm}. Executed then deleted, or swept once past {@code expiresAt}.
 * {@code fields} is the DRAFT payload the executor reads. Referenced by id (no cross-context
 * relation, ADR-008).
 */
@Entity
@Table(name = "assistant_pending_actions")
@Getter
@Setter
@NoArgsConstructor
public class PendingAction {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "claim_id", nullable = false, unique = true)
  private String claimId;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(nullable = false)
  private String action;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private Map<String, Object> fields = Map.of();

  @Column private String summary;

  @Column private String risk;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "expires_at", nullable = false)
  private LocalDateTime expiresAt;
}
