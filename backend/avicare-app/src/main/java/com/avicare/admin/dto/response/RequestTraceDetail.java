package com.avicare.admin.dto.response;

import java.time.LocalDateTime;
import java.util.List;

/**
 * One trace, opened.
 *
 * @param auditActions the staff audit entries recorded under the same correlation id — what the
 *     request meant in business terms, next to what it did technically
 */
public record RequestTraceDetail(
    Long id,
    String requestId,
    String method,
    String path,
    String routePattern,
    Integer statusCode,
    Integer durationMs,
    Long userId,
    String userEmail,
    Long farmId,
    String ip,
    String requestBody,
    String responseBody,
    String errorMessage,
    String stackTrace,
    LocalDateTime startedAt,
    LocalDateTime endedAt,
    /**
     * Identifiant de trace OpenTelemetry, nul quand l'agent ne tournait pas. La console n'affiche
     * le lien vers Jaeger que s'il est présent : un lien mort est pire que pas de lien.
     */
    String otelTraceId,
    List<String> auditActions) {}
