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

  /**
   * The three defects found in production on 2026-10-06, each taken from a real stored number.
   * Konekt answered HTTP 502 ("ce numéro n'est pas joignable sur WhatsApp") 18 times because the
   * country code of a foreign number was treated as part of a local one.
   */
  @Test
  void keepsAForeignCountryCode_insteadOfGluing221InFrontOfIt() {
    // Bénin. Was becoming 2212290169566061 — 16 digits, nobody.
    assertThat(normalizer.toKonekt("+2290169566061")).isEqualTo("2290169566061");
    assertThat(normalizer.toKonekt("+229 0141112086")).isEqualTo("2290141112086");
    // France. Was becoming 22133681013759.
    assertThat(normalizer.toKonekt("+33681013759")).isEqualTo("33681013759");
  }

  /**
   * A leading zero is the national trunk prefix: it is how the number is dialled *inside* the
   * country and never part of the international form. Production held 0190181930, which was
   * becoming 2210190181930 — thirteen digits, one too many.
   *
   * <p>This rule is the best one available, not a cure. A bare 0190181930 could also be a Beninese
   * number typed without its +229, and no algorithm can tell. That ambiguity is precisely what the
   * country selector removes at the source — the normalizer only guesses when nobody told it.
   */
  @Test
  void dropsTheLocalTrunkZero() {
    assertThat(normalizer.toKonekt("077 000 00 00")).isEqualTo("221770000000");
    assertThat(normalizer.toKonekt("0770000000")).isEqualTo("221770000000");
  }

  @Test
  void refusesANumberThatCannotBeOne() {
    // A number too short or absurdly long is a data error, not a recipient: fail at write time
    // rather than burn five send attempts against the gateway.
    assertThat(normalizer.toKonekt("12345")).isNull();
    assertThat(normalizer.toKonekt("2212290156343408")).isNull();
  }

  @Test
  void returnsNull_whenNoDigits() {
    assertThat(normalizer.toKonekt("  ")).isNull();
    assertThat(normalizer.toKonekt(null)).isNull();
  }
}
