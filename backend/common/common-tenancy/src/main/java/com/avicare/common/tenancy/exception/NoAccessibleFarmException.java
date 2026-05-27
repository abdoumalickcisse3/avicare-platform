package com.avicare.common.tenancy.exception;

import com.avicare.common.api.exception.ForbiddenException;

/**
 * Thrown when the current user has no farm they can access (empty {@code accessibleFarmIds} on
 * their {@link com.avicare.common.tenancy.context.TenantData}). Maps to HTTP 403 via the global
 * exception handler.
 */
public class NoAccessibleFarmException extends ForbiddenException {

  public NoAccessibleFarmException() {
    super("NO_ACCESSIBLE_FARM", "User has no accessible farm");
  }
}
