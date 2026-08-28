package com.avicare.admin.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.admin.domain.StaffPermission;
import com.avicare.admin.repository.StaffPermissionRepository;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.UserRole;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StaffAccessCheckerTest {

  private static final Long STAFF_ID = 42L;

  @Mock StaffPermissionRepository repository;

  @AfterEach
  void clearAuth() {
    SecurityContextHolder.clearContext();
  }

  private StaffAccessChecker checker() {
    return new StaffAccessChecker(new StaffPermissionService(repository));
  }

  private void authenticate(Long userId, UserRole role) {
    AvicarePrincipal principal = new AvicarePrincipal(userId, "staff@jawdi.app", role, List.of());
    var auth = new UsernamePasswordAuthenticationToken(principal.email(), null, List.of());
    auth.setDetails(principal);
    SecurityContextHolder.getContext().setAuthentication(auth);
  }

  private void grants(String... permissions) {
    when(repository.findByUserId(STAFF_ID))
        .thenReturn(
            List.of(permissions).stream()
                .map(
                    p -> {
                      StaffPermission sp = new StaffPermission();
                      sp.setUserId(STAFF_ID);
                      sp.setPermission(p);
                      return sp;
                    })
                .toList());
  }

  @Test
  void theWildcardOpensEverything() {
    authenticate(STAFF_ID, UserRole.ADMIN);
    grants("*");

    assertThat(checker().can("partners:attach")).isTrue();
    assertThat(checker().can("compliance:delete")).isTrue();
  }

  @Test
  void anExactPermissionOpensOnlyItself() {
    authenticate(STAFF_ID, UserRole.ADMIN);
    grants("partners:read");

    assertThat(checker().can("partners:read")).isTrue();
    assertThat(checker().can("partners:attach")).isFalse();
  }

  @Test
  void aResourceWildcardOpensItsWholeResource() {
    authenticate(STAFF_ID, UserRole.ADMIN);
    grants("partners:*");

    assertThat(checker().can("partners:attach")).isTrue();
    assertThat(checker().can("tenants:write")).isFalse();
  }

  @Test
  void staffWithNoPermissionRowIsRefused() {
    // Being platform staff is not a right in itself: TenantData.isSuperAdmin would already say
    // true here, and this gate still says no.
    authenticate(STAFF_ID, UserRole.ADMIN);
    grants();

    assertThat(checker().can("tenants:read")).isFalse();
    assertThat(checker().isStaff()).isTrue();
  }

  @Test
  void anOrdinaryUserIsRefusedEvenHoldingTheRow() {
    // An aberrant row in staff_permissions must not turn a farmer into staff.
    authenticate(7L, UserRole.USER);
    when(repository.findByUserId(7L))
        .thenReturn(
            List.of(
                new StaffPermission() {
                  {
                    setUserId(7L);
                    setPermission("*");
                  }
                }));

    assertThat(checker().can("tenants:read")).isFalse();
    assertThat(checker().isStaff()).isFalse();
  }

  @Test
  void refusesWhenNobodyIsAuthenticated() {
    assertThat(checker().can("tenants:read")).isFalse();
    assertThat(checker().isStaff()).isFalse();
  }
}
