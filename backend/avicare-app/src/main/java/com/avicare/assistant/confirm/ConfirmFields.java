package com.avicare.assistant.confirm;

import java.util.Map;

/** Lenient coercion of the JSONB {@code fields} map an executor reads. */
final class ConfirmFields {

  private ConfirmFields() {}

  static Long asLong(Map<String, Object> fields, String key) {
    Object v = fields.get(key);
    if (v instanceof Number n) {
      return n.longValue();
    }
    try {
      return v == null ? null : Long.parseLong(v.toString().trim());
    } catch (NumberFormatException e) {
      return null;
    }
  }

  static long asLongOr(Map<String, Object> fields, String key, long fallback) {
    Long v = asLong(fields, key);
    return v != null ? v : fallback;
  }

  static int asInt(Map<String, Object> fields, String key) {
    Long v = asLong(fields, key);
    return v != null ? v.intValue() : 0;
  }

  static String asString(Map<String, Object> fields, String key) {
    Object v = fields.get(key);
    if (v == null) {
      return null;
    }
    String s = v.toString().trim();
    return s.isEmpty() ? null : s;
  }
}
