package com.avicare.reporting.domain;

import com.avicare.common.api.exception.ValidationException;
import java.time.LocalDate;

/** Resolves the time window for a dashboard: preset (today/7d/30d/mtd) or custom date range. */
public record DashboardPeriod(String kind, String value, LocalDate from, LocalDate to) {

  public static DashboardPeriod resolve(
      String period, LocalDate from, LocalDate to, LocalDate today) {
    boolean hasCustom = from != null || to != null;
    if (period != null && hasCustom) {
      throw new ValidationException(
          "PERIOD_AMBIGUOUS", "Provide either 'period' or a 'from'/'to' range, not both.");
    }
    if (hasCustom) {
      if (from == null || to == null) {
        throw new ValidationException(
            "PERIOD_INCOMPLETE", "Custom range requires both 'from' and 'to'.");
      }
      if (from.isAfter(to)) {
        throw new ValidationException("PERIOD_INVALID_RANGE", "'from' must not be after 'to'.");
      }
      return new DashboardPeriod("custom", "custom", from, to);
    }
    String preset = period == null ? "30d" : period;
    return switch (preset) {
      case "today" -> new DashboardPeriod("preset", "today", today, today);
      case "7d" -> new DashboardPeriod("preset", "7d", today.minusDays(6), today);
      case "30d" -> new DashboardPeriod("preset", "30d", today.minusDays(29), today);
      case "mtd" -> new DashboardPeriod("preset", "mtd", today.withDayOfMonth(1), today);
      default ->
          throw new ValidationException(
              "PERIOD_UNKNOWN_PRESET", "Unknown period preset: " + preset);
    };
  }
}
