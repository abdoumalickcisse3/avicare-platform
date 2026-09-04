package com.avicare.admin.trace;

import com.avicare.admin.domain.RequestTrace;
import com.avicare.admin.repository.RequestTraceRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Cleans a {@link RequestTraceDraft} and persists it, off the request thread.
 *
 * <p>Three rules govern what ends up in the table, and they are the reason this class exists rather
 * than a one-line {@code repository.save()}:
 *
 * <ol>
 *   <li><b>Secrets never land.</b> Any JSON field whose name looks like a credential is replaced by
 *       {@value #MASK}, at any depth. The login payload is the obvious case, but a password reset,
 *       a token refresh or a staff temporary password would be just as damaging.
 *   <li><b>Only JSON is kept.</b> A body of another type (multipart upload, form post, binary) is
 *       not stored at all: we cannot mask what we cannot parse, and an unmaskable body is a leak
 *       waiting to happen.
 *   <li><b>Payloads are truncated.</b> A trace is a debugging aid, not a shadow copy of the
 *       farmer's data.
 * </ol>
 *
 * <p>Never throws: a failure to record a trace must not turn into a failed request, and the caller
 * is a {@code finally} block.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RequestTraceRecorder {

  static final String MASK = "***";
  private static final String TRUNCATION_SUFFIX = "… [tronqué]";
  private static final String NON_JSON_BODY = "[corps non-JSON, non capturé]";
  private static final String UNPARSABLE_BODY = "[corps JSON illisible, non capturé]";
  private static final int MAX_STACK_TRACE_CHARS = 8_000;

  /**
   * A field is masked when its name contains one of these. Substring matching, not equality: it
   * covers {@code password}, {@code currentPassword}, {@code refreshToken}, {@code apiSecret} and
   * whatever similar field is added next, without anyone having to remember to update this list.
   */
  private static final List<String> SENSITIVE_MARKERS =
      List.of("password", "secret", "token", "apikey", "otp", "credential");

  private final RequestTraceRepository repository;
  private final ObjectMapper objectMapper;
  private final TracingProperties properties;

  @Async(TracingConfig.EXECUTOR)
  public void record(RequestTraceDraft draft) {
    try {
      repository.save(toEntity(draft));
    } catch (RuntimeException e) {
      // Warn, not error: a lost trace costs debugging comfort, nothing more. Loud enough to be
      // noticed if it becomes systematic (a full disk, a broken migration).
      log.warn(
          "Failed to record request trace {} {} ({}): {}",
          draft.method(),
          draft.path(),
          draft.requestId(),
          e.toString());
    }
  }

  RequestTrace toEntity(RequestTraceDraft draft) {
    return RequestTrace.builder()
        .requestId(draft.requestId())
        .method(draft.method())
        .path(truncate(draft.path(), 500))
        .routePattern(truncate(draft.routePattern(), 200))
        .userId(draft.userId())
        .userEmail(truncate(draft.userEmail(), 255))
        .farmId(draft.farmId())
        .statusCode(draft.statusCode())
        .durationMs(draft.durationMs())
        .ip(truncate(draft.ip(), 45))
        .requestBody(
            sanitizeBody(
                draft.requestBody(), draft.requestContentType(), properties.maxRequestBodyChars()))
        .responseBody(
            // The response is only ever kept on an error, and the error responses this platform
            // emits are RFC 7807 JSON.
            sanitizeBody(
                draft.responseBody(), "application/json", properties.maxResponseBodyChars()))
        .errorMessage(errorMessage(draft.error()))
        .stackTrace(stackTrace(draft.error()))
        .startedAt(draft.startedAt())
        .endedAt(draft.endedAt())
        .otelTraceId(draft.otelTraceId())
        .build();
  }

  /** Masks credentials, drops what cannot be parsed, and truncates the rest. */
  String sanitizeBody(String body, String contentType, int maxChars) {
    if (body == null || body.isBlank()) {
      return null;
    }
    if (contentType == null || !contentType.toLowerCase().contains("json")) {
      return NON_JSON_BODY;
    }
    try {
      JsonNode root = objectMapper.readTree(body);
      maskInPlace(root);
      return truncate(objectMapper.writeValueAsString(root), maxChars);
    } catch (Exception e) {
      return UNPARSABLE_BODY;
    }
  }

  /** Walks the tree and blanks every value whose field name looks like a credential. */
  private static void maskInPlace(JsonNode node) {
    if (node instanceof ObjectNode object) {
      for (Iterator<Map.Entry<String, JsonNode>> it = object.fields(); it.hasNext(); ) {
        Map.Entry<String, JsonNode> field = it.next();
        if (isSensitive(field.getKey())) {
          object.put(field.getKey(), MASK);
        } else {
          maskInPlace(field.getValue());
        }
      }
    } else if (node != null && node.isArray()) {
      node.forEach(RequestTraceRecorder::maskInPlace);
    }
  }

  private static boolean isSensitive(String fieldName) {
    String lower = fieldName.toLowerCase();
    return SENSITIVE_MARKERS.stream().anyMatch(lower::contains);
  }

  private static String errorMessage(Throwable error) {
    if (error == null) {
      return null;
    }
    String message = error.getMessage();
    return truncate(
        message == null
            ? error.getClass().getName()
            : error.getClass().getSimpleName() + ": " + message,
        1_000);
  }

  private static String stackTrace(Throwable error) {
    if (error == null) {
      return null;
    }
    StringWriter writer = new StringWriter();
    error.printStackTrace(new PrintWriter(writer));
    return truncate(writer.toString(), MAX_STACK_TRACE_CHARS);
  }

  private static String truncate(String value, int maxChars) {
    if (value == null || value.length() <= maxChars) {
      return value;
    }
    return value.substring(0, Math.max(0, maxChars - TRUNCATION_SUFFIX.length()))
        + TRUNCATION_SUFFIX;
  }
}
