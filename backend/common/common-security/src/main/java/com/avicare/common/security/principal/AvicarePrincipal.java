package com.avicare.common.security.principal;

import java.util.List;
import java.util.Objects;

/**
 * Authenticated user representation, built by the JWT layer and carried through the request.
 *
 * <p>The {@code role} field is the platform-wide role (e.g. {@code "SUPER_ADMIN"},
 * {@code "ADMIN"}, {@code "USER"}). Per-farm roles and permissions live in {@link Membership}s.
 *
 * <p>{@code memberships} is defensively copied; the record is fully immutable.
 *
 * @param userId platform user identifier
 * @param email user email (used for logging and audit)
 * @param role platform-wide role
 * @param memberships per-farm memberships
 */
public record AvicarePrincipal(
    Long userId, String email, String role, List<Membership> memberships) {

  public static final String ROLE_SUPER_ADMIN = "SUPER_ADMIN";
  public static final String ROLE_ADMIN = "ADMIN";

  public AvicarePrincipal {
    Objects.requireNonNull(userId, "userId must not be null");
    Objects.requireNonNull(role, "role must not be null");
    Objects.requireNonNull(memberships, "memberships must not be null");
    memberships = List.copyOf(memberships);
  }

  /** Whether the user is a platform super-admin (bypasses every farm check). */
  public boolean isSuperAdmin() {
    return ROLE_SUPER_ADMIN.equals(role);
  }

  /** Whether the user is at least an admin (admin or super-admin). */
  public boolean isAdmin() {
    return ROLE_ADMIN.equals(role) || isSuperAdmin();
  }

  /**
   * Whether the user has any membership on the given farm. Super-admins always return
   * {@code true}.
   */
  public boolean hasFarmAccess(Long farmId) {
    if (isSuperAdmin()) {
      return true;
    }
    return memberships.stream().anyMatch(m -> m.farmId().equals(farmId));
  }

  /** Farm identifiers the user has any membership on. Empty for users with no memberships. */
  public List<Long> accessibleFarmIds() {
    return memberships.stream().map(Membership::farmId).toList();
  }
}
