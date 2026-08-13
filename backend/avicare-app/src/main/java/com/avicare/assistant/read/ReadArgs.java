package com.avicare.assistant.read;

/** Lenient coercion of the loosely-typed argument map read tools receive. */
final class ReadArgs {

  private ReadArgs() {}

  /** A positive day window, defaulting when absent/unparseable and capped at {@code max}. */
  static int clampDays(Object raw, int defaultDays, int max) {
    if (raw instanceof Number n && n.intValue() > 0) {
      return Math.min(n.intValue(), max);
    }
    try {
      int parsed = raw == null ? defaultDays : Integer.parseInt(raw.toString().trim());
      return parsed > 0 ? Math.min(parsed, max) : defaultDays;
    } catch (NumberFormatException e) {
      return defaultDays;
    }
  }
}
