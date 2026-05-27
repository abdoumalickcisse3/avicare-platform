package com.avicare.common.security.exception;

/**
 * Thrown when a JWT is structurally valid and unexpired but has the wrong {@code type} claim for
 * the operation (e.g. an access token presented to {@code validateRefreshToken}).
 */
public class WrongTokenTypeException extends TokenValidationException {

  public WrongTokenTypeException(String expected, String actual) {
    super("Wrong JWT type: expected '" + expected + "' but got '" + actual + "'");
  }
}
