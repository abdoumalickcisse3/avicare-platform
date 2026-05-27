package com.avicare.common.api.error;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.net.URI;
import java.time.Instant;
import java.util.Map;

/**
 * RFC 7807 Problem Details error response.
 *
 * <p>JSON shape:
 *
 * <pre>{@code
 * {
 *   "type": "https://avicare.com/errors/batch-not-found",
 *   "title": "Batch Not Found",
 *   "status": 404,
 *   "detail": "Batch with id 42 not found",
 *   "instance": "/api/v1/batches/42",
 *   "code": "BATCH_NOT_FOUND",
 *   "traceId": "abc-123",
 *   "timestamp": "2026-...",
 *   "properties": { ... }
 * }
 * }</pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProblemDetailResponse(
    URI type,
    String title,
    int status,
    String detail,
    URI instance,
    String code,
    String traceId,
    Instant timestamp,
    Map<String, Object> properties) {

  public static Builder builder() {
    return new Builder();
  }

  public static class Builder {
    private URI type;
    private String title;
    private int status;
    private String detail;
    private URI instance;
    private String code;
    private String traceId;
    private Instant timestamp = Instant.now();
    private Map<String, Object> properties;

    public Builder type(URI type) {
      this.type = type;
      return this;
    }

    public Builder title(String title) {
      this.title = title;
      return this;
    }

    public Builder status(int status) {
      this.status = status;
      return this;
    }

    public Builder detail(String detail) {
      this.detail = detail;
      return this;
    }

    public Builder instance(URI instance) {
      this.instance = instance;
      return this;
    }

    public Builder code(String code) {
      this.code = code;
      return this;
    }

    public Builder traceId(String traceId) {
      this.traceId = traceId;
      return this;
    }

    public Builder timestamp(Instant timestamp) {
      this.timestamp = timestamp;
      return this;
    }

    public Builder properties(Map<String, Object> properties) {
      this.properties = properties;
      return this;
    }

    public ProblemDetailResponse build() {
      return new ProblemDetailResponse(
          type, title, status, detail, instance, code, traceId, timestamp, properties);
    }
  }
}
