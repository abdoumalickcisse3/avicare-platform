package com.avicare.admin.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One HTTP request as seen from the outside: who called what, how long it took, what came back.
 *
 * <p><b>Append-only and short-lived.</b> No setters and no {@code updatedAt} — a trace is written
 * once, then purged by {@code RequestTracePurgeJob} once past the retention window. Unlike {@link
 * AdminAuditLog} it carries no legal weight, so the database does not lock it down: it is a
 * debugging aid, and it must be deletable for the retention job to do its work.
 *
 * <p>Bodies are captured under strict rules (see {@code RequestTraceRecorder}): secrets masked,
 * content truncated, response kept only on errors. The point is to answer "what happened at 10:37"
 * without turning the table into a shadow copy of the farmer's data.
 */
@Entity
@Table(name = "request_traces")
@Getter
@NoArgsConstructor
public class RequestTrace {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "request_id", nullable = false)
  private String requestId;

  /**
   * Identifiant de trace OpenTelemetry, quand l'agent tourne. Permet à la console d'ouvrir la
   * décomposition en spans correspondante dans Jaeger. Nul quand le traçage est désactivé — un état
   * normal, pas une anomalie.
   */
  @Column(name = "otel_trace_id")
  private String otelTraceId;

  @Column(nullable = false)
  private String method;

  @Column(nullable = false)
  private String path;

  /** The mapped route ({@code /api/v1/farms/{farmId}}), stable across ids. Null if unmatched. */
  @Column(name = "route_pattern")
  private String routePattern;

  @Column(name = "user_id")
  private Long userId;

  @Column(name = "user_email")
  private String userEmail;

  @Column(name = "farm_id")
  private Long farmId;

  @Column(name = "status_code")
  private Integer statusCode;

  @Column(name = "duration_ms")
  private Integer durationMs;

  @Column private String ip;

  @Column(name = "request_body")
  private String requestBody;

  @Column(name = "response_body")
  private String responseBody;

  @Column(name = "error_message")
  private String errorMessage;

  @Column(name = "stack_trace")
  private String stackTrace;

  @Column(name = "started_at", nullable = false)
  private LocalDateTime startedAt;

  @Column(name = "ended_at", nullable = false)
  private LocalDateTime endedAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Builder
  RequestTrace(
      String requestId,
      String method,
      String path,
      String routePattern,
      Long userId,
      String userEmail,
      Long farmId,
      Integer statusCode,
      Integer durationMs,
      String ip,
      String requestBody,
      String responseBody,
      String errorMessage,
      String stackTrace,
      LocalDateTime startedAt,
      LocalDateTime endedAt,
      String otelTraceId) {
    this.requestId = requestId;
    this.otelTraceId = otelTraceId;
    this.method = method;
    this.path = path;
    this.routePattern = routePattern;
    this.userId = userId;
    this.userEmail = userEmail;
    this.farmId = farmId;
    this.statusCode = statusCode;
    this.durationMs = durationMs;
    this.ip = ip;
    this.requestBody = requestBody;
    this.responseBody = responseBody;
    this.errorMessage = errorMessage;
    this.stackTrace = stackTrace;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
  }
}
