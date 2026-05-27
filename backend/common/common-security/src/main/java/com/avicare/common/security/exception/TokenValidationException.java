package com.avicare.common.security.exception;

import org.springframework.security.core.AuthenticationException;

/**
 * Base type for every JWT validation failure surfaced by the security layer. Extends Spring's
 * {@link AuthenticationException} so the global handler in {@code common-api} maps it to a 401
 * Problem Details response automatically.
 */
public abstract class TokenValidationException extends AuthenticationException {

  protected TokenValidationException(String message) {
    super(message);
  }

  protected TokenValidationException(String message, Throwable cause) {
    super(message, cause);
  }
}
