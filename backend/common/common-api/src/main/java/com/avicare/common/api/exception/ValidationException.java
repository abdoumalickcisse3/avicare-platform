package com.avicare.common.api.exception;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;

/** Thrown when request validation fails (HTTP 400). */
public class ValidationException extends BusinessException {

  public ValidationException(String code, String message) {
    super(code, message, HttpStatus.BAD_REQUEST);
  }

  public ValidationException(String code, String message, List<FieldError> errors) {
    super(code, message, HttpStatus.BAD_REQUEST, Map.of("errors", errors));
  }

  /** Per-field validation failure. */
  public record FieldError(String field, String code, String message) {}
}
