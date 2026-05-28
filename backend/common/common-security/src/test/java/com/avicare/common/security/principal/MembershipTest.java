package com.avicare.common.security.principal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class MembershipTest {

  @Test
  void exactPermission_matches() {
    Membership m = new Membership(1L, FarmRole.FARMER, List.of("poultry:write"));

    assertThat(m.hasPermission("poultry:write")).isTrue();
    assertThat(m.hasPermission("poultry:read")).isFalse();
    assertThat(m.hasPermission("health:write")).isFalse();
  }

  @Test
  void resourceWildcard_grantsEveryVerbOnThatResource() {
    Membership m = new Membership(1L, FarmRole.MANAGER, List.of("poultry:*"));

    assertThat(m.hasPermission("poultry:read")).isTrue();
    assertThat(m.hasPermission("poultry:write")).isTrue();
    assertThat(m.hasPermission("poultry:delete")).isTrue();
    assertThat(m.hasPermission("health:write")).isFalse();
  }

  @Test
  void starPermission_grantsEverything() {
    Membership m = new Membership(1L, FarmRole.OWNER, List.of("*"));

    assertThat(m.hasPermission("poultry:write")).isTrue();
    assertThat(m.hasPermission("anything:anything")).isTrue();
    assertThat(m.hasPermission("bare-string-without-colon")).isTrue();
  }

  @Test
  void permissionsAreDefensivelyCopied() {
    List<String> mutable = new ArrayList<>(List.of("poultry:read"));
    Membership m = new Membership(1L, FarmRole.FARMER, mutable);

    mutable.add("poultry:write");

    assertThat(m.permissions()).containsExactly("poultry:read");
    assertThat(m.hasPermission("poultry:write")).isFalse();
  }

  @Test
  void hasRole_singleCandidate_matches() {
    Membership m = new Membership(1L, FarmRole.OWNER, List.of());

    assertThat(m.hasRole(FarmRole.OWNER)).isTrue();
    assertThat(m.hasRole(FarmRole.FARMER)).isFalse();
  }

  @Test
  void hasRole_multipleCandidates_matchesIfAny() {
    Membership m = new Membership(1L, FarmRole.MANAGER, List.of());

    assertThat(m.hasRole(FarmRole.OWNER, FarmRole.MANAGER)).isTrue();
    assertThat(m.hasRole(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.FARMER)).isTrue();
    assertThat(m.hasRole(FarmRole.OWNER, FarmRole.FARMER)).isFalse();
  }

  @Test
  void hasRole_emptyArray_returnsFalse() {
    Membership m = new Membership(1L, FarmRole.OWNER, List.of());

    assertThat(m.hasRole()).isFalse();
  }

  @Test
  void nullArguments_throwNpe() {
    assertThatNullPointerException()
        .isThrownBy(() -> new Membership(null, FarmRole.FARMER, List.of()));
    assertThatNullPointerException()
        .isThrownBy(() -> new Membership(1L, null, List.of()));
    assertThatNullPointerException()
        .isThrownBy(() -> new Membership(1L, FarmRole.FARMER, null));
  }
}
