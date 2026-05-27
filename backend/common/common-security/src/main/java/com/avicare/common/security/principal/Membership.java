package com.avicare.common.security.principal;

import java.util.List;
import java.util.Objects;

/**
 * One user-to-farm membership: the user's role on a single farm and the explicit permissions
 * granted on that farm.
 *
 * <p>Permission format is {@code "resource:verb"} (e.g. {@code "poultry:write"}). Two wildcards
 * are honored:
 *
 * <ul>
 *   <li>{@code "*"} — grants every permission
 *   <li>{@code "<resource>:*"} — grants every verb on a given resource
 * </ul>
 *
 * <p>{@code permissions} is defensively copied to make this record fully immutable.
 *
 * @param farmId identifier of the farm
 * @param farmRole role label scoped to this farm (e.g. {@code "OWNER"}, {@code "MANAGER"},
 *     {@code "FARMER"})
 * @param permissions explicit permission strings granted on this farm
 */
public record Membership(Long farmId, String farmRole, List<String> permissions) {

  public Membership {
    Objects.requireNonNull(farmId, "farmId must not be null");
    Objects.requireNonNull(farmRole, "farmRole must not be null");
    Objects.requireNonNull(permissions, "permissions must not be null");
    permissions = List.copyOf(permissions);
  }

  /** Whether this membership grants the given permission, honoring {@code *} wildcards. */
  public boolean hasPermission(String permission) {
    Objects.requireNonNull(permission, "permission must not be null");
    if (permissions.contains("*")) {
      return true;
    }
    int colon = permission.indexOf(':');
    if (colon > 0) {
      String resourceWildcard = permission.substring(0, colon) + ":*";
      if (permissions.contains(resourceWildcard)) {
        return true;
      }
    }
    return permissions.contains(permission);
  }
}
