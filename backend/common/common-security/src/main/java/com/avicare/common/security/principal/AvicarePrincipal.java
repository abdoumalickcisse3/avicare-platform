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
 * @param impersonatedBy the staff user acting as this user, or {@code null} in a normal session.
 *     Support sessions carry the TARGET's identity so authorization behaves exactly as it does for
 *     the farmer; this is the only thing that says who is really behind the request, and the audit
 *     trail depends on it.
 */
public record AvicarePrincipal(
    Long userId, String email, UserRole role, List<Membership> memberships, Long impersonatedBy) {

  /** A normal session: nobody is acting on behalf of anyone. */
  public AvicarePrincipal(Long userId, String email, UserRole role, List<Membership> memberships) {
    this(userId, email, role, memberships, null);
  }

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

  /** Whether this request is a staff member acting as a farmer. */
  public boolean isImpersonation() {
    return impersonatedBy != null;
  }

  /**
   * Who is really behind the request: the staff member during a support session, the user
   * otherwise. This is the identity the audit trail must record.
   */
  public Long effectiveActorId() {
    return impersonatedBy != null ? impersonatedBy : userId;
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
