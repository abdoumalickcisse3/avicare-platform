package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

/** Thrown on resource state conflict (HTTP 409). */
public class ConflictException extends BusinessException {

  public ConflictException(String code, String message) {
    super(code, message, HttpStatus.CONFLICT);
  }
}
