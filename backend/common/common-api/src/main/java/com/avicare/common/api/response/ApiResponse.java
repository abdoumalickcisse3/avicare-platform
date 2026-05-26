package com.avicare.common.api.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/**
 * Standard HTTP response wrapper.
 *
 * <p>JSON format:
 *
 * <pre>{@code
 * { "data": T, "meta": { ... } }
 * }</pre>
 *
 * <p>The {@code meta} field is optional and omitted when {@code null}.
 *
 * @param <T> payload data type
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(T data, Map<String, Object> meta) {

  public static <T> ApiResponse<T> of(T data) {
    return new ApiResponse<>(data, null);
  }

  public static <T> ApiResponse<T> of(T data, Map<String, Object> meta) {
    return new ApiResponse<>(data, meta);
  }
}
