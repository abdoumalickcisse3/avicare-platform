package com.avicare.common.security.access;

import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.FarmRole;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * SpEL bean backing every tenant-level {@code @PreAuthorize} check.
 *
 * <p>Usage in a controller:
 *
 * <pre>{@code
 * @PreAuthorize("@farmAccess.hasPermission(#farmId, 'poultry:write')")
 * }</pre>
 *
 * <p>The current {@link AvicarePrincipal} is read from the Spring {@code Authentication} details
 * (populated by the JWT filter — Session 4b-2). Platform admins ({@link
 * AvicarePrincipal#isAdmin()}) bypass every check; everyone else is scoped to their per-farm {@link
 * com.avicare.common.security.principal.Membership}. When no authenticated principal is present,
 * every method denies (returns {@code false}) — fail-closed by default.
 */
@Component("farmAccess")
@Slf4j
public class FarmAccessChecker {

  /**
   * Whether the current user holds {@code permission} (e.g. {@code "poultry:write"}) on the given
   * farm. Honors the {@code *} and {@code "resource:*"} wildcards carried by the membership.
   */
  public boolean hasPermission(Long farmId, String permission) {
    AvicarePrincipal principal = currentPrincipal();
    if (principal == null) {
      return false;
    }
    if (principal.isAdmin()) {
      log.debug("Access granted via platform ADMIN for user {}", principal.userId());
      return true;
    }
    return principal.membershipOf(farmId).map(m -> m.hasPermission(permission)).orElse(false);
  }

  /** Whether the current user holds AT LEAST ONE of the given permissions on the farm. */
  public boolean hasAnyPermission(Long farmId, String... permissions) {
    for (String permission : permissions) {
      if (hasPermission(farmId, permission)) {
        return true;
      }
    }
    return false;
  }

  /** Whether the current user holds ALL of the given permissions on the farm. */
  public boolean hasAllPermissions(Long farmId, String... permissions) {
    for (String permission : permissions) {
      if (!hasPermission(farmId, permission)) {
        return false;
      }
    }
    return true;
  }

  /** Whether the current user can reach the farm at all (any membership, or platform admin). */
  public boolean hasAccess(Long farmId) {
    AvicarePrincipal principal = currentPrincipal();
    return principal != null && principal.hasFarmAccess(farmId);
  }

  /**
   * Whether the current user's role on the farm is one of {@code candidates}. Platform admins
   * bypass; everyone else needs a membership on the farm whose role matches.
   */
  public boolean hasRole(Long farmId, FarmRole... candidates) {
    AvicarePrincipal principal = currentPrincipal();
    if (principal == null) {
      return false;
    }
    if (principal.isAdmin()) {
      return true;
    }
    return principal.membershipOf(farmId).map(m -> m.hasRole(candidates)).orElse(false);
  }

  /** Reads the {@link AvicarePrincipal} from the security context, or {@code null} if absent. */
  private AvicarePrincipal currentPrincipal() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) {
      return null;
    }
    return auth.getDetails() instanceof AvicarePrincipal principal ? principal : null;
  }
}
