package com.avicare.assistant.tool;

import java.util.ArrayList;
import java.util.List;

/** Lenient coercion of the loosely-typed argument map the model returns. */
final class ToolArgs {

  private ToolArgs() {}

  static int asInt(Object v) {
    if (v instanceof Number n) {
      return n.intValue();
    }
    try {
      return v == null ? 0 : Integer.parseInt(v.toString().trim());
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  static Integer asIntOrNull(Object v) {
    if (v instanceof Number n) {
      return n.intValue();
    }
    if (v == null) {
      return null;
    }
    try {
      return Integer.parseInt(v.toString().trim());
    } catch (NumberFormatException e) {
      return null;
    }
  }

  static Double asDoubleOrNull(Object v) {
    if (v instanceof Number n) {
      return n.doubleValue();
    }
    if (v == null) {
      return null;
    }
    try {
      return Double.parseDouble(v.toString().trim().replace(',', '.'));
    } catch (NumberFormatException e) {
      return null;
    }
  }

  static String asString(Object v) {
    if (v == null) {
      return null;
    }
    String s = v.toString().trim();
    return s.isEmpty() ? null : s;
  }

  static List<Integer> asIntList(Object v) {
    List<Integer> out = new ArrayList<>();
    if (v instanceof List<?> list) {
      for (Object o : list) {
        Integer i = asIntOrNull(o);
        if (i != null && i > 0) {
          out.add(i);
        }
      }
    }
    return out;
  }
}
