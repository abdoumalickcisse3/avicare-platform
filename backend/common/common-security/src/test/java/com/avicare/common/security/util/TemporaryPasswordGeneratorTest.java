package com.avicare.common.security.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TemporaryPasswordGeneratorTest {
  @Test
  void generates_a_password_of_expected_length_without_ambiguous_chars() {
    String pw = TemporaryPasswordGenerator.generate();
    assertThat(pw).hasSize(12);
    assertThat(pw).doesNotContainAnyWhitespaces();
    // no ambiguous characters O/0/o/l/1/I
    assertThat(pw).doesNotContain("O", "0", "l", "1", "I");
  }

  @Test
  void generates_distinct_passwords() {
    assertThat(TemporaryPasswordGenerator.generate())
        .isNotEqualTo(TemporaryPasswordGenerator.generate());
  }
}
