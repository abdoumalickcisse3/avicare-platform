package com.avicare.notification.whatsapp;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PhoneNormalizerTest {

  private final PhoneNormalizer normalizer = new PhoneNormalizer("221");

  @Test
  void stripsPlusAndSpaces_keepingCountryCode() {
    assertThat(normalizer.toKonekt("+221 77 000 00 00")).isEqualTo("221770000000");
  }

  @Test
  void prefixesCountryCode_forLocalNumber() {
    assertThat(normalizer.toKonekt("770000000")).isEqualTo("221770000000");
  }

  @Test
  void handlesDoubleZeroInternationalPrefix() {
    assertThat(normalizer.toKonekt("00221770000000")).isEqualTo("221770000000");
  }

  @Test
  void returnsNull_whenNoDigits() {
    assertThat(normalizer.toKonekt("  ")).isNull();
    assertThat(normalizer.toKonekt(null)).isNull();
  }
}
