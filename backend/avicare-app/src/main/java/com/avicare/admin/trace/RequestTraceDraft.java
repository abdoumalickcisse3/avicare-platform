package com.avicare.admin.trace;

import java.time.LocalDateTime;

/**
 * What the filter observed about one request, before masking and truncation.
 *
 * <p>Raw on purpose: the cleaning work (masking secrets, truncating payloads) belongs to {@link
 * RequestTraceRecorder}, which runs off the request thread. The filter's job is to grab the facts
 * and get out of the way.
 *
 * @param error the exception that ended the request, when one was seen — either escaping the filter
 *     chain, or handed over by the global exception handler through a request attribute
 * @param otelTraceId the OpenTelemetry trace id, read from the MDC <b>on the request thread</b>:
 *     {@link RequestTraceRecorder} is {@code @Async} and the MDC does not propagate there, so
 *     reading it any later would return null on every request
 */
public record RequestTraceDraft(
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
    String requestContentType,
    String responseBody,
    Throwable error,
    LocalDateTime startedAt,
    LocalDateTime endedAt,
    String otelTraceId) {}
