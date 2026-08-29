package com.avicare.admin.service;

import com.avicare.admin.domain.StaffPermission;
import com.avicare.admin.dto.response.StaffMemberRow;
import com.avicare.admin.repository.StaffPermissionRepository;
import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ForbiddenException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.common.security.access.StaffPermissionCatalog;
import com.avicare.common.security.principal.UserRole;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.identity.service.RefreshTokenService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Grants, edits and withdraws platform staff access — the console managing itself.
 *
 * <p>Until this existed, changing a staff right meant a hand-written {@code UPDATE} against
 * production: outside the application, and therefore outside the audit trail. Every path here is
 * recorded by {@link AdminAuditService}.
 *
 * <p>Three guards, each closing a way this screen could otherwise be turned against the platform:
 *
 * <ul>
 *   <li><b>No self-edit.</b> A holder of {@code staff:manage} must not touch their own row —
 *       otherwise that single permission is a ladder to {@code "*"}. It also makes self-lockout
 *       impossible: nobody can demote themselves by accident.
 *   <li><b>Only {@code "*"} grants {@code "*"}.</b> Without this, {@code staff:manage} escalates to
 *       super-admin through a second account.
 *   <li><b>The last super-admin stays.</b> Removing the final {@code "*"} would leave a console
 *       nobody can administer — recoverable only by the founder bootstrap, i.e. a redeploy.
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class StaffAdminService {

  static final String ALL_PERMISSIONS = "*";

  private final UserRepository userRepository;
  private final StaffPermissionRepository staffPermissions;
  private final RefreshTokenService refreshTokenService;
  private final AdminAuditService auditService;

  /** Every staff account with the permissions it holds, super-admins first then by name. */
  @Transactional(readOnly = true)
  public List<StaffMemberRow> list() {
    List<User> staff = userRepository.findByRole(UserRole.ADMIN);
    if (staff.isEmpty()) {
      return List.of();
    }
    Map<Long, List<String>> byUser =
        staffPermissions.findByUserIdIn(staff.stream().map(User::getId).toList()).stream()
            .collect(
                Collectors.groupingBy(
                    StaffPermission::getUserId,
                    Collectors.mapping(StaffPermission::getPermission, Collectors.toList())));
    return staff.stream()
        .map(u -> toRow(u, byUser.getOrDefault(u.getId(), List.of())))
        .sorted(
            Comparator.comparing(StaffMemberRow::superAdmin)
                .reversed()
                .thenComparing(r -> r.fullName() == null ? "" : r.fullName()))
        .toList();
  }

  /** The assignable resources and verbs, so the screen never hard-codes the taxonomy. */
  @Transactional(readOnly = true)
  public List<StaffPermissionCatalog.ResourceDef> catalog() {
    return StaffPermissionCatalog.RESOURCES;
  }

  /**
   * Promote an existing account to platform staff, with no permission attached.
   *
   * <p>Granting access and deciding what it covers are two steps on purpose: a promotion that
   * silently carried rights would make the second screen decorative.
   */
  @Transactional
  public StaffMemberRow grantStaff(Long userId) {
    User user = load(userId);
    if (user.getRole() == UserRole.ADMIN) {
      throw new BusinessRuleException("STAFF_ALREADY", "Ce compte fait déjà partie du personnel.");
    }
    if (!user.isActive()) {
      throw new BusinessRuleException(
          "STAFF_INACTIVE_ACCOUNT", "Un compte désactivé ne peut pas recevoir un accès console.");
    }
    user.setRole(UserRole.ADMIN);
    userRepository.save(user);
    auditService.record("staff.grant", "User", userId, null, Map.of("email", user.getEmail()));
    return toRow(user, List.of());
  }

  /**
   * Withdraw staff access: role, permissions and sessions all go.
   *
   * <p>The sessions matter as much as the role. An access token already issued carries {@code
   * role=ADMIN} and stays valid until it expires, so without this the demotion would only take
   * effect minutes later — the minutes that count when access is withdrawn in a hurry.
   */
  @Transactional
  public void revokeStaff(Long userId) {
    User user = load(userId);
    refuseSelf(userId, "Vous ne pouvez pas retirer votre propre accès à la console.");
    if (user.getRole() != UserRole.ADMIN) {
      throw new BusinessRuleException(
          "STAFF_NOT_STAFF", "Ce compte ne fait pas partie du personnel.");
    }
    boolean wasSuperAdmin = holds(userId, ALL_PERMISSIONS);
    if (wasSuperAdmin) {
      refuseLastSuperAdmin();
    }
    user.setRole(UserRole.USER);
    userRepository.save(user);
    staffPermissions.deleteByUserId(userId);
    refreshTokenService.revokeAllForUser(userId);
    auditService.record(
        "staff.revoke", "User", userId, null, Map.of("wasSuperAdmin", wasSuperAdmin));
  }

  /** Replace a staff member's permissions with exactly {@code requested}. */
  @Transactional
  public StaffMemberRow setPermissions(Long userId, List<String> requested) {
    User user = load(userId);
    refuseSelf(userId, "Vous ne pouvez pas modifier vos propres permissions.");
    if (user.getRole() != UserRole.ADMIN) {
      throw new BusinessRuleException(
          "STAFF_NOT_STAFF", "Ce compte ne fait pas partie du personnel.");
    }

    Set<String> target = new LinkedHashSet<>(requested == null ? List.of() : requested);
    List<String> invalid = target.stream().filter(p -> !StaffPermissionCatalog.isValid(p)).toList();
    if (!invalid.isEmpty()) {
      // A farm permission lands here too: the taxonomies are disjoint by design.
      throw new ValidationException(
          "STAFF_PERMISSION_UNKNOWN", "Permission inconnue : " + String.join(", ", invalid));
    }

    Set<String> current =
        staffPermissions.findByUserId(userId).stream()
            .map(StaffPermission::getPermission)
            .collect(Collectors.toCollection(LinkedHashSet::new));

    if (target.contains(ALL_PERMISSIONS)
        && !current.contains(ALL_PERMISSIONS)
        && !holds(currentActorId(), ALL_PERMISSIONS)) {
      throw new ForbiddenException(
          "STAFF_WILDCARD_FORBIDDEN",
          "Seul un super-administrateur peut accorder toutes les permissions.");
    }
    if (current.contains(ALL_PERMISSIONS) && !target.contains(ALL_PERMISSIONS)) {
      refuseLastSuperAdmin();
    }

    List<StaffPermission> existing = staffPermissions.findByUserId(userId);
    List<StaffPermission> toRemove =
        existing.stream().filter(p -> !target.contains(p.getPermission())).toList();
    staffPermissions.deleteAll(toRemove);

    Long actor = currentActorId();
    List<StaffPermission> toAdd = new ArrayList<>();
    for (String permission : target) {
      if (!current.contains(permission)) {
        StaffPermission granted = new StaffPermission();
        granted.setUserId(userId);
        granted.setPermission(permission);
        granted.setGrantedBy(actor);
        toAdd.add(granted);
      }
    }
    staffPermissions.saveAll(toAdd);

    // Permissions are read from the database on every check, so the change bites immediately and
    // there is no session to revoke here.
    auditService.record(
        "staff.permissions.update",
        "User",
        userId,
        null,
        Map.of(
            "granted", toAdd.stream().map(StaffPermission::getPermission).sorted().toList(),
            "revoked", toRemove.stream().map(StaffPermission::getPermission).sorted().toList()));
    return toRow(user, List.copyOf(target));
  }

  private void refuseSelf(Long userId, String message) {
    if (userId != null && userId.equals(currentActorId())) {
      throw new ForbiddenException("STAFF_SELF_EDIT", message);
    }
  }

  private void refuseLastSuperAdmin() {
    if (staffPermissions.countByPermission(ALL_PERMISSIONS) <= 1) {
      throw new BusinessRuleException(
          "STAFF_LAST_SUPER_ADMIN",
          "Il doit rester au moins un super-administrateur. Désignez-en un autre d'abord.");
    }
  }

  private boolean holds(Long userId, String permission) {
    return userId != null && staffPermissions.existsByUserIdAndPermission(userId, permission);
  }

  private static Long currentActorId() {
    return TenancyContext.tryGet().map(t -> t.userId()).orElse(null);
  }

  private User load(Long userId) {
    return userRepository
        .findById(userId)
        .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User " + userId));
  }

  private static StaffMemberRow toRow(User user, List<String> permissions) {
    List<String> sorted = permissions.stream().sorted().toList();
    return new StaffMemberRow(
        user.getId(),
        user.getEmail(),
        user.getFullName(),
        sorted,
        sorted.contains(ALL_PERMISSIONS),
        user.isActive(),
        user.getLastLoginAt());
  }
}
