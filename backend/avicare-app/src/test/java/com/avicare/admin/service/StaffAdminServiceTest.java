package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.admin.domain.StaffPermission;
import com.avicare.admin.dto.response.StaffMemberRow;
import com.avicare.admin.repository.StaffPermissionRepository;
import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ForbiddenException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.common.tenancy.context.TenantData;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.identity.service.RefreshTokenService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StaffAdminServiceTest {

  private static final Long ACTOR = 1L;
  private static final Long TARGET = 2L;

  @Mock UserRepository userRepository;
  @Mock StaffPermissionRepository staffPermissions;
  @Mock RefreshTokenService refreshTokenService;
  @Mock AdminAuditService auditService;

  private StaffAdminService service;

  @BeforeEach
  void setUp() {
    service =
        new StaffAdminService(userRepository, staffPermissions, refreshTokenService, auditService);
    TenancyContext.set(new TenantData(ACTOR, List.of(), true));
  }

  @AfterEach
  void tearDown() {
    TenancyContext.clear();
  }

  private User user(Long id, UserRole role, boolean active) {
    User u = new User();
    u.setId(id);
    u.setEmail("u" + id + "@jawdi.app");
    u.setFullName("User " + id);
    u.setRole(role);
    u.setActive(active);
    when(userRepository.findById(id)).thenReturn(Optional.of(u));
    return u;
  }

  private StaffPermission permission(Long userId, String value) {
    StaffPermission p = new StaffPermission();
    p.setUserId(userId);
    p.setPermission(value);
    return p;
  }

  private void heldByTarget(String... permissions) {
    when(staffPermissions.findByUserId(TARGET))
        .thenReturn(java.util.Arrays.stream(permissions).map(p -> permission(TARGET, p)).toList());
    for (String p : permissions) {
      when(staffPermissions.existsByUserIdAndPermission(TARGET, p)).thenReturn(true);
    }
  }

  private void actorIsSuperAdmin(boolean value) {
    when(staffPermissions.existsByUserIdAndPermission(ACTOR, "*")).thenReturn(value);
  }

  private void superAdminCount(long count) {
    when(staffPermissions.countByPermission("*")).thenReturn(count);
  }

  @SuppressWarnings("unchecked")
  private List<StaffPermission> savedPermissions() {
    ArgumentCaptor<List<StaffPermission>> captor = ArgumentCaptor.captor();
    verify(staffPermissions).saveAll(captor.capture());
    return captor.getValue();
  }

  @SuppressWarnings("unchecked")
  private List<StaffPermission> deletedPermissions() {
    ArgumentCaptor<List<StaffPermission>> captor = ArgumentCaptor.captor();
    verify(staffPermissions).deleteAll(captor.capture());
    return captor.getValue();
  }

  // --- listing -------------------------------------------------------------

  @Test
  void listsStaffWithTheirPermissionsAndSuperAdminsFirst() {
    User plain = user(TARGET, UserRole.ADMIN, true);
    User boss = user(3L, UserRole.ADMIN, true);
    when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of(plain, boss));
    when(staffPermissions.findByUserIdIn(List.of(TARGET, 3L)))
        .thenReturn(List.of(permission(TARGET, "tenants:read"), permission(3L, "*")));

    List<StaffMemberRow> rows = service.list();

    assertThat(rows).extracting(StaffMemberRow::userId).containsExactly(3L, TARGET);
    assertThat(rows.get(0).superAdmin()).isTrue();
    assertThat(rows.get(1).permissions()).containsExactly("tenants:read");
    assertThat(rows.get(1).superAdmin()).isFalse();
  }

  @Test
  void listsNothingWithoutQueryingPermissionsWhenThereIsNoStaff() {
    when(userRepository.findByRole(UserRole.ADMIN)).thenReturn(List.of());

    assertThat(service.list()).isEmpty();
    // findByUserIdIn(emptyList) is a pointless round trip, and some drivers reject `IN ()`.
    verify(staffPermissions, never()).findByUserIdIn(any());
  }

  // --- granting staff ------------------------------------------------------

  @Test
  void promotesAnAccountWithNoPermissionAttached() {
    User target = user(TARGET, UserRole.USER, true);

    StaffMemberRow row = service.grantStaff(TARGET);

    assertThat(target.getRole()).isEqualTo(UserRole.ADMIN);
    assertThat(row.permissions()).isEmpty();
    assertThat(row.superAdmin()).isFalse();
    // Access and scope are two decisions; a promotion that carried rights would make the
    // permission screen decorative.
    verify(staffPermissions, never()).save(any());
    verify(auditService).record(eq("staff.grant"), eq("User"), eq(TARGET), isNull(), any());
  }

  @Test
  void refusesToPromoteAnAccountThatIsAlreadyStaff() {
    user(TARGET, UserRole.ADMIN, true);

    assertThatThrownBy(() -> service.grantStaff(TARGET))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("déjà");
  }

  @Test
  void refusesToPromoteADisabledAccount() {
    user(TARGET, UserRole.USER, false);

    // Otherwise a disabled account carries console rights the day it is re-enabled.
    assertThatThrownBy(() -> service.grantStaff(TARGET))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("désactivé");
  }

  // --- revoking staff ------------------------------------------------------

  @Test
  void revokingClearsRolePermissionsAndSessions() {
    user(TARGET, UserRole.ADMIN, true);
    heldByTarget("tenants:read");
    superAdminCount(2);

    service.revokeStaff(TARGET);

    verify(staffPermissions).deleteByUserId(TARGET);
    // An access token already issued still says role=ADMIN until it expires; without this the
    // withdrawal would only bite minutes later.
    verify(refreshTokenService).revokeAllForUser(TARGET);
  }

  @Test
  void refusesToRevokeYourOwnAccess() {
    user(ACTOR, UserRole.ADMIN, true);

    // Self-lockout, and the reason nobody can quietly demote the account watching them.
    assertThatThrownBy(() -> service.revokeStaff(ACTOR))
        .isInstanceOf(ForbiddenException.class)
        .hasMessageContaining("votre propre accès");
    verify(userRepository, never()).save(any());
  }

  @Test
  void refusesToRevokeTheLastSuperAdmin() {
    user(TARGET, UserRole.ADMIN, true);
    heldByTarget("*");
    superAdminCount(1);

    // A console nobody can administer is only recoverable through the founder bootstrap.
    assertThatThrownBy(() -> service.revokeStaff(TARGET))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("super-administrateur");
    verify(refreshTokenService, never()).revokeAllForUser(anyLong());
  }

  // --- permissions ---------------------------------------------------------

  @Test
  void replacesThePermissionSetAndReportsTheDelta() {
    user(TARGET, UserRole.ADMIN, true);
    heldByTarget("tenants:read", "users:read");
    actorIsSuperAdmin(true);

    StaffMemberRow row = service.setPermissions(TARGET, List.of("tenants:read", "partners:write"));

    assertThat(savedPermissions())
        .extracting(StaffPermission::getPermission)
        .containsExactly("partners:write");
    assertThat(deletedPermissions())
        .extracting(StaffPermission::getPermission)
        .containsExactly("users:read");
    assertThat(row.permissions()).containsExactly("partners:write", "tenants:read");
  }

  @Test
  void stampsWhoGrantedThePermission() {
    user(TARGET, UserRole.ADMIN, true);
    heldByTarget();
    actorIsSuperAdmin(true);

    service.setPermissions(TARGET, List.of("catalog:write"));

    assertThat(savedPermissions())
        .singleElement()
        .satisfies(p -> assertThat(p.getGrantedBy()).isEqualTo(ACTOR));
  }

  @Test
  void rejectsAPermissionOutsideTheStaffTaxonomy() {
    user(TARGET, UserRole.ADMIN, true);
    heldByTarget();

    // "livestock:read" is a valid FARM permission — and must not validate here.
    assertThatThrownBy(
            () -> service.setPermissions(TARGET, List.of("tenants:read", "livestock:read")))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("livestock:read");
    verify(staffPermissions, never()).saveAll(any());
  }

  @Test
  void refusesToEditYourOwnPermissions() {
    user(ACTOR, UserRole.ADMIN, true);

    // Without this, staff:manage alone is a ladder to "*".
    assertThatThrownBy(() -> service.setPermissions(ACTOR, List.of("*")))
        .isInstanceOf(ForbiddenException.class)
        .hasMessageContaining("vos propres permissions");
  }

  @Test
  void refusesToGrantTheWildcardWithoutHoldingIt() {
    user(TARGET, UserRole.ADMIN, true);
    heldByTarget("tenants:read");
    actorIsSuperAdmin(false);

    // staff:manage would otherwise escalate to super-admin through a second account.
    assertThatThrownBy(() -> service.setPermissions(TARGET, List.of("*")))
        .isInstanceOf(ForbiddenException.class)
        .hasMessageContaining("super-administrateur");
    verify(staffPermissions, never()).saveAll(any());
  }

  @Test
  void allowsASuperAdminToGrantTheWildcard() {
    user(TARGET, UserRole.ADMIN, true);
    heldByTarget();
    actorIsSuperAdmin(true);

    StaffMemberRow row = service.setPermissions(TARGET, List.of("*"));

    assertThat(row.superAdmin()).isTrue();
  }

  @Test
  void refusesToStripTheLastWildcard() {
    user(TARGET, UserRole.ADMIN, true);
    heldByTarget("*");
    actorIsSuperAdmin(true);
    superAdminCount(1);

    assertThatThrownBy(() -> service.setPermissions(TARGET, List.of("tenants:read")))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("au moins un super-administrateur");
  }

  @Test
  void keepingTheWildcardIsNotAGrantAndNeedsNoCheck() {
    user(TARGET, UserRole.ADMIN, true);
    heldByTarget("*");
    actorIsSuperAdmin(false);
    superAdminCount(2);

    // Re-sending the same set must not be read as an escalation attempt.
    StaffMemberRow row = service.setPermissions(TARGET, List.of("*"));

    assertThat(row.superAdmin()).isTrue();
  }

  @Test
  void refusesToTouchAnAccountThatIsNotStaff() {
    user(TARGET, UserRole.USER, true);

    assertThatThrownBy(() -> service.setPermissions(TARGET, List.of("tenants:read")))
        .isInstanceOf(BusinessRuleException.class);
    assertThatThrownBy(() -> service.revokeStaff(TARGET)).isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void treatsANullPermissionListAsEmpty() {
    user(TARGET, UserRole.ADMIN, true);
    heldByTarget("tenants:read");
    actorIsSuperAdmin(true);

    StaffMemberRow row = service.setPermissions(TARGET, null);

    assertThat(row.permissions()).isEmpty();
    assertThat(deletedPermissions()).hasSize(1);
  }
}
