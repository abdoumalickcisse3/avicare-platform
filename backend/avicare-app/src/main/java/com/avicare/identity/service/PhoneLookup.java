package com.avicare.identity.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Turns a phone number as a human typed it into the handful of digit strings it could be stored as.
 *
 * <p>A farmer types their number the way they say it. The same person signs in with {@code 77 184
 * 27 87} on Monday and {@code +221771842787} on Tuesday, and since V63 the column holds the second
 * shape. Comparing the typed digits to the stored digits for strict equality — which is what
 * password reset did — means the short form silently finds nobody.
 *
 * <p>So the lookup asks for every shape at once: the digits as typed, the same without a national
 * trunk zero, and those prefixed with the default country code. Three candidates, one query, no
 * country table on the server: the apps' country picker is what makes the stored value exact, and
 * this only has to forgive what people type into a sign-in box.
 */
@Component
public class PhoneLookup {

  private final String defaultCountryCode;

  public PhoneLookup(@Value("${app.default-country-code:221}") String defaultCountryCode) {
    this.defaultCountryCode = defaultCountryCode;
  }

  /** Digits only — never compare punctuation, it differs by the day the row was written. */
  public static String digitsOf(String raw) {
    return raw == null ? "" : raw.replaceAll("\\D", "");
  }

  /**
   * Every stored digit-string {@code raw} could mean, most literal first. Empty when {@code raw}
   * holds no digits, so a blank identifier never matches the whole table.
   */
  public List<String> candidates(String raw) {
    String digits = digitsOf(raw);
    if (digits.isEmpty()) {
      return List.of();
    }
    // LinkedHashSet: order is kept for readability, duplicates dropped when the forms coincide.
    Set<String> out = new LinkedHashSet<>();
    out.add(digits);
    String withoutTrunk = digits.replaceFirst("^0+", "");
    if (!withoutTrunk.isEmpty()) {
      out.add(withoutTrunk);
      if (!withoutTrunk.startsWith(defaultCountryCode)) {
        out.add(defaultCountryCode + withoutTrunk);
      }
    }
    return List.copyOf(out);
  }
}
