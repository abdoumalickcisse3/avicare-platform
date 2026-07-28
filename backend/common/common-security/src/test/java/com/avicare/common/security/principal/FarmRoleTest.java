package com.avicare.common.security.principal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class FarmRoleTest {

  @Test
  void values_returnsFiveCanonicalRoles() {
    assertThat(FarmRole.values())
        .containsExactly(
            FarmRole.OWNER,
            FarmRole.MANAGER,
            FarmRole.FARMER,
            FarmRole.VETERINARIAN,
            FarmRole.BUYER);
  }

  @Test
  void owner_defaultPermissions_isFullWildcard() {
    assertThat(FarmRole.OWNER.defaultPermissions()).containsExactly("*");
  }

  @Test
  void manager_defaultPermissions_hasOperationalScope() {
    assertThat(FarmRole.MANAGER.defaultPermissions())
        .containsExactly(
            "poultry:*",
            "health:*",
            "commercial:*",
            "inventory:*",
            "finance:read",
            "settings:read");
  }

  @Test
  void farmer_defaultPermissions_hasFieldOperatorScope() {
    assertThat(FarmRole.FARMER.defaultPermissions())
        .containsExactly(
            "poultry:read", "poultry:write", "health:read", "health:write", "inventory:consume");
  }

  @Test
  void veterinarian_defaultPermissions_hasHealthScope() {
    assertThat(FarmRole.VETERINARIAN.defaultPermissions())
        .containsExactly("health:read", "health:write", "poultry:read", "inventory:consume");
  }

  @Test
  void buyer_defaultPermissions_isCommercialReadOnly() {
    assertThat(FarmRole.BUYER.defaultPermissions())
        .containsExactly("commercial:read", "finance:read");
  }

  @Test
  void defaultPermissions_returnsImmutableList() {
    var defaults = FarmRole.MANAGER.defaultPermissions();

    assertThatThrownBy(() -> defaults.add("rogue:permission"))
        .isInstanceOf(UnsupportedOperationException.class);
  }
}
