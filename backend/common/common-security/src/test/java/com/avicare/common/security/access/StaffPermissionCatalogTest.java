package com.avicare.common.security.access;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class StaffPermissionCatalogTest {

  @Test
  void acceptsTheSuperAdminWildcard() {
    assertThat(StaffPermissionCatalog.isValid("*")).isTrue();
  }

  @Test
  void acceptsAKnownResourceVerbAndAResourceWildcard() {
    assertThat(StaffPermissionCatalog.isValid("partners:attach")).isTrue();
    assertThat(StaffPermissionCatalog.isValid("users:reset-password")).isTrue();
    assertThat(StaffPermissionCatalog.isValid("partners:*")).isTrue();
  }

  @Test
  void rejectsAnUnknownResourceOrVerb() {
    assertThat(StaffPermissionCatalog.isValid("partners:destroy")).isFalse();
    assertThat(StaffPermissionCatalog.isValid("unicorns:read")).isFalse();
  }

  @Test
  void rejectsMalformedInput() {
    assertThat(StaffPermissionCatalog.isValid(null)).isFalse();
    assertThat(StaffPermissionCatalog.isValid("")).isFalse();
    assertThat(StaffPermissionCatalog.isValid("   ")).isFalse();
    assertThat(StaffPermissionCatalog.isValid("partners")).isFalse();
    assertThat(StaffPermissionCatalog.isValid("partners:")).isFalse();
    assertThat(StaffPermissionCatalog.isValid(":read")).isFalse();
  }

  @Test
  void theStaffAndFarmTaxonomiesAreDisjoint() {
    // A farm permission written into staff_permissions must not validate, and the reverse.
    // Confusing the two would silently grant platform-wide rights from a farm-scoped string.
    assertThat(StaffPermissionCatalog.isValid("poultry:read")).isFalse();
    assertThat(StaffPermissionCatalog.isValid("finance:write")).isFalse();
    assertThat(PermissionCatalog.isValid("partners:attach")).isFalse();
    assertThat(PermissionCatalog.isValid("impersonate:open")).isFalse();
  }

  @Test
  void everyConstantIsValidAndEveryResourceIsLabelled() {
    // Guards the drift between the constants, the verb map and the display catalog.
    assertThat(StaffPermissionCatalog.isValid(StaffPermissionConstants.TENANTS_READ)).isTrue();
    assertThat(StaffPermissionCatalog.isValid(StaffPermissionConstants.IMPERSONATE)).isTrue();
    assertThat(StaffPermissionCatalog.isValid(StaffPermissionConstants.PARTNERS_PROSPECT)).isTrue();
    assertThat(StaffPermissionCatalog.isValid(StaffPermissionConstants.STAFF_MANAGE)).isTrue();

    assertThat(StaffPermissionCatalog.RESOURCES)
        .hasSameSizeAs(StaffPermissionConstants.RESOURCE_VERBS.entrySet())
        .allSatisfy(
            r -> {
              assertThat(r.label()).isNotBlank();
              assertThat(r.verbs()).isNotEmpty();
            });
  }
}
