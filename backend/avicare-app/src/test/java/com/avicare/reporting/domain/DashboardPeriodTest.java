package com.avicare.reporting.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.api.exception.ValidationException;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class DashboardPeriodTest {

  private static final LocalDate TODAY = LocalDate.of(2026, 6, 22);

  @Test
  void preset30dSpansLast30DaysInclusive() {
    DashboardPeriod p = DashboardPeriod.resolve("30d", null, null, TODAY);
    assertThat(p.kind()).isEqualTo("preset");
    assertThat(p.value()).isEqualTo("30d");
    assertThat(p.to()).isEqualTo(TODAY);
    assertThat(p.from()).isEqualTo(LocalDate.of(2026, 5, 24)); // 29 jours avant -> 30 jours inclus
  }

  @Test
  void presetTodayIsSingleDay() {
    DashboardPeriod p = DashboardPeriod.resolve("today", null, null, TODAY);
    assertThat(p.from()).isEqualTo(TODAY);
    assertThat(p.to()).isEqualTo(TODAY);
  }

  @Test
  void presetMtdStartsFirstOfMonth() {
    DashboardPeriod p = DashboardPeriod.resolve("mtd", null, null, TODAY);
    assertThat(p.from()).isEqualTo(LocalDate.of(2026, 6, 1));
    assertThat(p.to()).isEqualTo(TODAY);
  }

  @Test
  void customRangeIsHonored() {
    DashboardPeriod p =
        DashboardPeriod.resolve(null, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 10), TODAY);
    assertThat(p.kind()).isEqualTo("custom");
    assertThat(p.from()).isEqualTo(LocalDate.of(2026, 6, 1));
    assertThat(p.to()).isEqualTo(LocalDate.of(2026, 6, 10));
  }

  @Test
  void defaultsTo30dWhenNothingProvided() {
    assertThat(DashboardPeriod.resolve(null, null, null, TODAY).value()).isEqualTo("30d");
  }

  @Test
  void rejectsCustomWithFromAfterTo() {
    assertThatThrownBy(
            () ->
                DashboardPeriod.resolve(
                    null, LocalDate.of(2026, 6, 10), LocalDate.of(2026, 6, 1), TODAY))
        // 400: a different pair of dates would be accepted, so this is a bad request, not a rule.
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void rejectsUnknownPreset() {
    assertThatThrownBy(() -> DashboardPeriod.resolve("yearly", null, null, TODAY))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void rejectsPresetAndCustomTogether() {
    assertThatThrownBy(() -> DashboardPeriod.resolve("7d", LocalDate.of(2026, 6, 1), null, TODAY))
        .isInstanceOf(ValidationException.class);
  }
}
