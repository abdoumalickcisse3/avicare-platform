package com.avicare.common.security.principal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class AvicarePrincipalTest {

  private static final Membership OWNER_OF_42 =
      new Membership(42L, FarmRole.OWNER, List.of("*"));
  private static final Membership FARMER_AT_43 =
      new Membership(43L, FarmRole.FARMER, List.of("poultry:read"));

  @Test
  void isAdmin_distinguishesAdminFromUser() {
    AvicarePrincipal admin = new AvicarePrincipal(1L, "a@a.io", UserRole.ADMIN, List.of());
    AvicarePrincipal user = new AvicarePrincipal(2L, "u@a.io", UserRole.USER, List.of());

    assertThat(admin.isAdmin()).isTrue();
    assertThat(user.isAdmin()).isFalse();
  }

  @Test
  void admin_alwaysHasFarmAccess() {
    AvicarePrincipal admin = new AvicarePrincipal(1L, "a@a.io", UserRole.ADMIN, List.of());

    assertThat(admin.hasFarmAccess(99L)).isTrue();
  }

  @Test
  void user_hasFarmAccess_onlyForMemberships() {
    AvicarePrincipal user =
        new AvicarePrincipal(
            3L, "u@a.io", UserRole.USER, List.of(OWNER_OF_42, FARMER_AT_43));

    assertThat(user.hasFarmAccess(42L)).isTrue();
    assertThat(user.hasFarmAccess(43L)).isTrue();
    assertThat(user.hasFarmAccess(44L)).isFalse();
  }

  @Test
  void membershipOf_returnsMatchingMembership() {
    AvicarePrincipal user =
        new AvicarePrincipal(
            3L, "u@a.io", UserRole.USER, List.of(OWNER_OF_42, FARMER_AT_43));

    assertThat(user.membershipOf(42L)).contains(OWNER_OF_42);
    assertThat(user.membershipOf(43L)).contains(FARMER_AT_43);
  }

  @Test
  void membershipOf_returnsEmptyForUnknownFarm() {
    AvicarePrincipal user =
        new AvicarePrincipal(3L, "u@a.io", UserRole.USER, List.of(OWNER_OF_42));

    assertThat(user.membershipOf(999L)).isEmpty();
  }

  @Test
  void accessibleFarmIds_returnsMembershipFarms() {
    AvicarePrincipal user =
        new AvicarePrincipal(
            3L, "u@a.io", UserRole.USER, List.of(OWNER_OF_42, FARMER_AT_43));

    assertThat(user.accessibleFarmIds()).containsExactly(42L, 43L);
  }

  @Test
  void membershipsAreDefensivelyCopied() {
    List<Membership> mutable = new ArrayList<>(List.of(OWNER_OF_42));
    AvicarePrincipal user = new AvicarePrincipal(3L, "u@a.io", UserRole.USER, mutable);

    mutable.add(FARMER_AT_43);

    assertThat(user.memberships()).containsExactly(OWNER_OF_42);
    assertThat(user.accessibleFarmIds()).containsExactly(42L);
  }

  @Test
  void nullArguments_throwNpe() {
    assertThatNullPointerException()
        .isThrownBy(() -> new AvicarePrincipal(null, "u@a.io", UserRole.USER, List.of()));
    assertThatNullPointerException()
        .isThrownBy(() -> new AvicarePrincipal(1L, "u@a.io", null, List.of()));
    assertThatNullPointerException()
        .isThrownBy(() -> new AvicarePrincipal(1L, "u@a.io", UserRole.USER, null));
  }
}
