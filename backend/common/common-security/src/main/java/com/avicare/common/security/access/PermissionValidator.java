package com.avicare.common.security.access;

import com.avicare.common.api.exception.ValidationException;
import java.util.List;

/** Rejects any permission string not present in {@link PermissionCatalog}. */
public final class PermissionValidator {

  private PermissionValidator() {}

  public static void validate(List<String> permissions) {
    if (permissions == null) return;
    for (String p : permissions) {
      if (!PermissionCatalog.isValid(p)) {
        throw new ValidationException("INVALID_PERMISSION", "Unknown permission: " + p);
      }
    }
  }
}
