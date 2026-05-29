package com.avicare.common.security.access;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.Membership;
import com.avicare.common.security.principal.UserRole;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class FarmAccessCheckerTest {

  private final FarmAccessChecker checker = new FarmAccessChecker();

  @AfterEach
  void clearContext() {
    SecurityContextHolder.clearContext();
  }

  @Test
  void platformAdmin_bypassesEveryCheck() {
    setPrincipal(new AvicarePrincipal(1L, "admin@avicare.com", UserRole.ADMIN, List.of()));

    assertThat(checker.hasPermission(99L, "poultry:write")).isTrue();
    assertThat(checker.hasAccess(99L)).isTrue();
    assertThat(checker.hasRole(99L, FarmRole.BUYER)).isTrue();
  }

  @Test
  void exactPermission_onMatchingFarm_grantsAccess() {
    setPrincipal(
        new AvicarePrincipal(
            2L,
            "user@avicare.com",
            UserRole.USER,
            List.of(new Membership(42L, FarmRole.FARMER, List.of("poultry:write")))));

    assertThat(checker.hasPermission(42L, "poultry:write")).isTrue();
    assertThat(checker.hasPermission(42L, "poultry:read")).isFalse();
    assertThat(checker.hasPermission(99L, "poultry:write")).isFalse();
  }

  @Test
  void resourceWildcard_grantsEveryVerbOnResource() {
    setPrincipal(
        new AvicarePrincipal(
            3L,
            "manager@avicare.com",
            UserRole.USER,
            List.of(new Membership(42L, FarmRole.MANAGER, List.of("poultry:*")))));

    assertThat(checker.hasPermission(42L, "poultry:read")).isTrue();
    assertThat(checker.hasPermission(42L, "poultry:delete")).isTrue();
    assertThat(checker.hasPermission(42L, "health:write")).isFalse();
  }

  @Test
  void starPermission_grantsEverything() {
    setPrincipal(
        new AvicarePrincipal(
            4L,
            "owner@avicare.com",
            UserRole.USER,
            List.of(new Membership(42L, FarmRole.OWNER, List.of("*")))));

    assertThat(checker.hasPermission(42L, "poultry:write")).isTrue();
    assertThat(checker.hasPermission(42L, "anything:anything")).isTrue();
  }

  @Test
  void hasAnyPermission_matchesIfAnyGranted() {
    setPrincipal(
        new AvicarePrincipal(
            5L,
            "user@avicare.com",
            UserRole.USER,
            List.of(new Membership(42L, FarmRole.FARMER, List.of("health:read")))));

    assertThat(checker.hasAnyPermission(42L, "poultry:write", "health:read")).isTrue();
    assertThat(checker.hasAnyPermission(42L, "poultry:write", "finance:read")).isFalse();
  }

  @Test
  void hasAllPermissions_requiresEveryPermission() {
    setPrincipal(
        new AvicarePrincipal(
            6L,
            "user@avicare.com",
            UserRole.USER,
            List.of(new Membership(42L, FarmRole.MANAGER, List.of("poultry:*", "health:read")))));

    assertThat(checker.hasAllPermissions(42L, "poultry:write", "health:read")).isTrue();
    assertThat(checker.hasAllPermissions(42L, "poultry:write", "finance:read")).isFalse();
  }

  @Test
  void hasRole_matchesMembershipRoleOnTargetFarm() {
    setPrincipal(
        new AvicarePrincipal(
            7L,
            "vet@avicare.com",
            UserRole.USER,
            List.of(new Membership(42L, FarmRole.VETERINARIAN, List.of("health:read")))));

    assertThat(checker.hasRole(42L, FarmRole.VETERINARIAN)).isTrue();
    assertThat(checker.hasRole(42L, FarmRole.OWNER, FarmRole.MANAGER)).isFalse();
    assertThat(checker.hasRole(99L, FarmRole.VETERINARIAN)).isFalse();
  }

  @Test
  void noAuthentication_deniesEverything() {
    assertThat(checker.hasPermission(42L, "poultry:write")).isFalse();
    assertThat(checker.hasAccess(42L)).isFalse();
    assertThat(checker.hasRole(42L, FarmRole.OWNER)).isFalse();
  }

  @Test
  void principalNotInDetails_deniesAccess() {
    var auth = new UsernamePasswordAuthenticationToken(1L, null, List.of());
    SecurityContextHolder.getContext().setAuthentication(auth);

    assertThat(checker.hasPermission(42L, "poultry:write")).isFalse();
  }

  private void setPrincipal(AvicarePrincipal principal) {
    var auth = new UsernamePasswordAuthenticationToken(principal.userId(), null, List.of());
    auth.setDetails(principal);
    SecurityContextHolder.getContext().setAuthentication(auth);
  }
}
