package com.avicare.admin.access;

import com.avicare.common.security.principal.AvicarePrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * SpEL gate for the back-office: {@code @PreAuthorize("@adminAccess.can('partners:attach')")}.
 *
 * <p>Two conditions, both required: the principal must be platform staff ({@code UserRole.ADMIN})
 * AND hold the named permission (or a wildcard). Fail-closed when no principal is present, like
 * {@link com.avicare.common.security.access.FarmAccessChecker}.
 *
 * <p><b>Vocabulary warning.</b> {@code TenantData.isSuperAdmin} already exists and means "is
 * platform staff", i.e. {@code UserRole.ADMIN}. Here, SUPER_ADMIN means something narrower: a staff
 * member holding the {@code *} permission. The two are not interchangeable — a staff account with
 * no row in {@code staff_permissions} passes {@code isSuperAdmin} and is refused by this gate.
 */
@Component("adminAccess")
@RequiredArgsConstructor
@Slf4j
public class StaffAccessChecker {

  private final StaffPermissionService permissions;

  /** Whether the caller is staff AND holds {@code permission}. */
  public boolean can(String permission) {
    AvicarePrincipal principal = currentPrincipal();
    if (principal == null || !principal.isAdmin()) {
      return false;
    }
    boolean granted = permissions.has(principal.userId(), permission);
    if (!granted) {
      log.debug("Staff {} denied for permission {}", principal.userId(), permission);
    }
    return granted;
  }

  /** Whether the caller is platform staff at all, whatever their permissions. */
  public boolean isStaff() {
    AvicarePrincipal principal = currentPrincipal();
    return principal != null && principal.isAdmin();
  }

  private AvicarePrincipal currentPrincipal() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) {
      return null;
    }
    return auth.getDetails() instanceof AvicarePrincipal principal ? principal : null;
  }
}
