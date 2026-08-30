package com.avicare.admin.dto.response;

import java.time.LocalDateTime;

/** One line of the console trace list — enough to scan, not enough to leak a payload. */
public record RequestTraceRow(
    Long id,
    String requestId,
    String method,
    String path,
    Integer statusCode,
    Integer durationMs,
    String userEmail,
    Long farmId,
    boolean hasError,
    LocalDateTime startedAt) {}
