package com.avicare.common.security.exception;

/** Thrown when a JWT has passed its expiration timestamp. */
public class ExpiredTokenException extends TokenValidationException {

  public ExpiredTokenException(Throwable cause) {
    super("JWT has expired", cause);
  }
}
