package com.avicare.common.api.exception;

import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * Abstract base for all business exceptions.
 *
 * <p>Every business error in the platform must extend this class. Mapped to RFC 7807 Problem
 * Details by the global exception handler.
 */
public abstract class BusinessException extends RuntimeException {

  private final String code;
  private final HttpStatus status;
  private final Map<String, Object> properties;

  protected BusinessException(String code, String message, HttpStatus status) {
    this(code, message, status, Map.of());
  }

  protected BusinessException(
      String code, String message, HttpStatus status, Map<String, Object> properties) {
    super(message);
    this.code = code;
    this.status = status;
    this.properties = properties;
  }

  public String getCode() {
    return code;
  }

  public HttpStatus getStatus() {
    return status;
  }

  public Map<String, Object> getProperties() {
    return properties;
  }
}
