package com.avicare.common.api.exception;

import org.springframework.http.HttpStatus;

/** Thrown when an entity is not found (HTTP 404). */
public class NotFoundException extends BusinessException {

  public NotFoundException(String code, String message) {
    super(code, message, HttpStatus.NOT_FOUND);
  }

  public static NotFoundException of(String entityType, Object id) {
    return new NotFoundException(
        entityType.toUpperCase() + "_NOT_FOUND", entityType + " with id " + id + " not found");
  }
}
