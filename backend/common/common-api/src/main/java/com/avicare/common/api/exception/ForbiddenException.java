package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

/** Thrown when access to a resource is denied (HTTP 403). */
public class ForbiddenException extends BusinessException {

  public ForbiddenException(String code, String message) {
    super(code, message, HttpStatus.FORBIDDEN);
  }

  public static ForbiddenException accessDenied(String resource) {
    return new ForbiddenException("ACCESS_DENIED", "Access denied to " + resource);
  }
}
