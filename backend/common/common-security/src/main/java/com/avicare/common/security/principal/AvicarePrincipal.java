package com.avicare.common.security.principal;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Authenticated user representation, built by the JWT layer and carried through the request.
 *
 * <p>The {@code role} field is the platform-wide role (see {@link UserRole}). Per-farm authority
 * lives in {@link Membership}s — one per (user, farm) couple.
 *
 * <p>{@code memberships} is defensively copied; the record is fully immutable.
 *
 * @param userId platform user identifier
 * @param email user email (used for logging and audit)
 * @param role platform-wide role
 * @param memberships per-farm memberships
 */
public record AvicarePrincipal(
    Long userId, String email, UserRole role, List<Membership> memberships) {

  public AvicarePrincipal {
    Objects.requireNonNull(userId, "userId must not be null");
    Objects.requireNonNull(role, "role must not be null");
    Objects.requireNonNull(memberships, "memberships must not be null");
    memberships = List.copyOf(memberships);
  }

  /** Whether the user is platform staff (bypasses every tenant-level check). */
  public boolean isAdmin() {
    return role == UserRole.ADMIN;
  }

  /** This user's membership on the given farm, if any. */
  public Optional<Membership> membershipOf(Long farmId) {
    return memberships.stream().filter(m -> m.farmId().equals(farmId)).findFirst();
  }

  /**
   * Whether the user can reach the given farm. Platform admins always return {@code true}; everyone
   * else needs a membership on it.
   */
  public boolean hasFarmAccess(Long farmId) {
    return isAdmin() || membershipOf(farmId).isPresent();
  }

  /** Farm identifiers the user has any membership on. Empty for users with no memberships. */
  public List<Long> accessibleFarmIds() {
    return memberships.stream().map(Membership::farmId).toList();
  }
}
