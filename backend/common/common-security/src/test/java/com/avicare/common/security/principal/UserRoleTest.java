package com.avicare.common.security.principal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class UserRoleTest {

  @Test
  void values_returnsAdminAndUserOnly() {
    assertThat(UserRole.values()).containsExactly(UserRole.ADMIN, UserRole.USER);
  }

  @Test
  void valueOf_acceptsKnownNames() {
    assertThat(UserRole.valueOf("ADMIN")).isEqualTo(UserRole.ADMIN);
    assertThat(UserRole.valueOf("USER")).isEqualTo(UserRole.USER);
  }

  @Test
  void valueOf_rejectsUnknown() {
    assertThatThrownBy(() -> UserRole.valueOf("SUPER_ADMIN"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> UserRole.valueOf("admin"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
