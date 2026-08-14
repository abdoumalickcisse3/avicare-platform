package com.avicare.assistant.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One append-only trace of an AI assistant interaction (V31): the field worker's {@code text} and
 * the assistant's outcome — a {@code DRAFT} (with its {@code action} + {@code summary}), an {@code
 * ANSWER}, or a {@code CLARIFICATION}. Immutable: only {@code created_at}, no updates, no soft
 * delete. {@code farmId}/{@code userId} are referenced by id (no cross-context relation, ADR-008).
 */
@Entity
@Table(name = "assistant_audit")
@Getter
@Setter
@NoArgsConstructor
public class AssistantAudit {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(nullable = false)
  private String text;

  @Column(nullable = false)
  private String kind;

  @Column private String action;

  @Column private String summary;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;
}
