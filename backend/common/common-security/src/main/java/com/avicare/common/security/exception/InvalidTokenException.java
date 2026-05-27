package com.avicare.common.security.exception;

/** Thrown when a JWT is malformed, has an invalid signature, or fails any structural check. */
public class InvalidTokenException extends TokenValidationException {

  public InvalidTokenException(String detail, Throwable cause) {
    super("Invalid JWT: " + detail, cause);
  }
}
