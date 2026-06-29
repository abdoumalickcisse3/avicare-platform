package com.avicare.common.security.access;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.ValidationException;
import java.util.List;
import org.junit.jupiter.api.Test;

class PermissionValidatorTest {
  @Test
  void accepts_known_permissions_wildcards_and_star() {
    assertThatCode(
            () ->
                PermissionValidator.validate(
                    List.of("poultry:read", "health:*", "commercial:write", "*")))
        .doesNotThrowAnyException();
  }

  @Test
  void rejects_unknown_resource_or_verb() {
    assertThatThrownBy(() -> PermissionValidator.validate(List.of("bogus:read")))
        .isInstanceOf(ValidationException.class);
    assertThatThrownBy(() -> PermissionValidator.validate(List.of("poultry:fly")))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void accepts_null_or_empty() {
    assertThatCode(() -> PermissionValidator.validate(null)).doesNotThrowAnyException();
    assertThatCode(() -> PermissionValidator.validate(List.of())).doesNotThrowAnyException();
  }
}
