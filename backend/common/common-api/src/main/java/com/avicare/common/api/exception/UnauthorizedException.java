package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

/** Thrown when authentication fails or is missing (HTTP 401). */
public class UnauthorizedException extends BusinessException {

  public UnauthorizedException(String code, String message) {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}
