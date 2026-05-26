package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown on non-status business rule violations (HTTP 422 Unprocessable Entity).
 *
 * <p>Example: "Cannot close a batch that still has live animals".
 */
public class BusinessRuleException extends BusinessException {

  public BusinessRuleException(String code, String message) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
