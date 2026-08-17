package com.avicare.notification.whatsapp;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Normalizes a stored phone number to the Konekt format {@code <cc><number>} (no {@code +}, no
 * spaces), e.g. {@code 221770000000} (Sprint C1 Phase 2). A local 9-digit Senegalese number gets
 * the default country code prefixed; a number already carrying its country code is kept as-is.
 */
@Component
public class PhoneNormalizer {

  private final String defaultCountryCode;

  public PhoneNormalizer(
      @Value("${notifications.whatsapp.default-country-code:221}") String defaultCountryCode) {
    this.defaultCountryCode = defaultCountryCode;
  }

  /** Returns the Konekt-formatted number, or {@code null} if {@code raw} has no usable digits. */
  public String toKonekt(String raw) {
    if (raw == null) {
      return null;
    }
    // Keep digits only (drops '+', spaces, dashes, parentheses).
    String digits = raw.replaceAll("\\D", "");
    if (digits.isEmpty()) {
      return null;
    }
    // A leading '00' international prefix becomes the bare country code.
    if (digits.startsWith("00")) {
      digits = digits.substring(2);
    }
    // Already carries the default country code.
    if (digits.startsWith(defaultCountryCode)) {
      return digits;
    }
    // Local number (e.g. 9-digit Senegalese) → prefix the default country code.
    return defaultCountryCode + digits;
  }
}
