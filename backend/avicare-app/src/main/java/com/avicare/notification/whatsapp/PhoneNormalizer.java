package com.avicare.notification.whatsapp;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Normalizes a stored phone number to the Konekt format {@code <cc><number>} (no {@code +}, no
 * spaces), e.g. {@code 221770000000} (Sprint C1 Phase 2).
 *
 * <p>The rule that matters: <strong>a leading {@code +} is information</strong>. It says "this
 * number already carries its own country code" — and the first version of this class destroyed it
 * before ever reading it, then prefixed {@code 221} to everything that did not already start with
 * {@code 221}. On 2026-10-06 that turned three Beninese numbers into sixteen-digit strangers and a
 * French one into a fourteen-digit one; Konekt answered HTTP 502 eighteen times, saying in a body
 * nobody displayed that the recipient was not reachable on WhatsApp.
 *
 * <p>So the order is now: read the {@code +} (and its {@code 00} equivalent) first, and only guess
 * a country for a number that carries none. Guessing is a last resort, not the default — the
 * country selector in the apps is what stops us having to guess at all.
 */
@Component
public class PhoneNormalizer {

  /** E.164 allows fifteen digits at most, country code included. */
  private static final int MAX_DIGITS = 15;

  /**
   * Ten is the floor for an international number in the markets this app serves: Senegal is 221 +
   * nine, Benin 229 + eight to ten, France 33 + nine. A handful of micro-states dial shorter; none
   * of them raises poultry here. Anything below ten is a typo, and a typo is cheaper to refuse than
   * to send.
   */
  private static final int MIN_DIGITS = 10;

  private final String defaultCountryCode;

  public PhoneNormalizer(
      @Value("${notifications.whatsapp.default-country-code:221}") String defaultCountryCode) {
    this.defaultCountryCode = defaultCountryCode;
  }

  /**
   * Returns the Konekt-formatted number, or {@code null} when {@code raw} cannot be one — no
   * digits, too short, or longer than E.164 allows. Returning {@code null} here is deliberate: the
   * enqueuer skips the recipient, which costs nothing, where sending costs five failed attempts
   * against the gateway before the row is given up on.
   */
  public String toKonekt(String raw) {
    if (raw == null) {
      return null;
    }
    String trimmed = raw.trim();
    // Read the international markers BEFORE stripping punctuation — that is the whole fix.
    boolean carriesItsOwnCountryCode = trimmed.startsWith("+") || trimmed.startsWith("00");

    String digits = trimmed.replaceAll("\\D", "");
    if (digits.startsWith("00")) {
      digits = digits.substring(2);
    }

    if (!carriesItsOwnCountryCode) {
      // A national trunk zero is how a number is dialled inside its country, never part of the
      // international form.
      if (digits.startsWith("0")) {
        digits = digits.replaceFirst("^0+", "");
      }
      if (!digits.startsWith(defaultCountryCode)) {
        digits = defaultCountryCode + digits;
      }
    }

    if (digits.length() < MIN_DIGITS || digits.length() > MAX_DIGITS) {
      return null;
    }
    return digits;
  }
}
