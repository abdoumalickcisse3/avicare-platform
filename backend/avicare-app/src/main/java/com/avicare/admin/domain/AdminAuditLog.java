package com.avicare.admin.domain;

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
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One entry of the platform back-office audit trail (super-admin console, Phase 0).
 *
 * <p><b>Append-only.</b> Deliberately no setters and no {@code updatedAt}: an entry is written once
 * and never touched again. The database enforces the same thing — {@code
 * trg_admin_audit_log_append_only} raises on any UPDATE or DELETE — because a trail that a database
 * connection can rewrite is not a trail.
 *
 * <p>{@code tenantId} is filled whenever the action concerns a farm. Attach/detach of a partner
 * network are the most sensitive entries there are: they open and close a third party's access to a
 * farmer's data.
 */
@Entity
@Table(name = "admin_audit_log")
@Getter
@NoArgsConstructor
@ToString
public class AdminAuditLog {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "actor_user_id", nullable = false)
  private Long actorUserId;

  @Column(nullable = false)
  private String action;

  @Column(name = "target_type")
  private String targetType;

  @Column(name = "target_id")
  private Long targetId;

  @Column(name = "tenant_id")
  private Long tenantId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false)
  private Map<String, Object> metadata = Map.of();

  @Column private String ip;

  /**
   * The correlation id of the request that produced this entry, when there was one. Joins the trail
   * to {@code request_traces}: from an action, its payload and timing; from a trace, the action it
   * stood for.
   */
  @Column(name = "request_id")
  private String requestId;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  /** The only way to build an entry: everything is set once, at construction. */
  public AdminAuditLog(
      Long actorUserId,
      String action,
      String targetType,
      Long targetId,
      Long tenantId,
      Map<String, Object> metadata,
      String ip,
      String requestId) {
    this.actorUserId = actorUserId;
    this.action = action;
    this.targetType = targetType;
    this.targetId = targetId;
    this.tenantId = tenantId;
    this.metadata = metadata == null ? Map.of() : metadata;
    this.ip = ip;
    this.requestId = requestId;
  }
}
