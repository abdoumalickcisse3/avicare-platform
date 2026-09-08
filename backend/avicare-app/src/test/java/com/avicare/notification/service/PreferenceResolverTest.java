package com.avicare.notification.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationChannel;
import com.avicare.notification.domain.NotificationPreference;
import com.avicare.notification.domain.NotificationSeverity;
import com.avicare.notification.service.PreferenceResolver.ResolvedPreference;
import java.util.List;
import org.junit.jupiter.api.Test;

class PreferenceResolverTest {

  private final PreferenceResolver resolver = new PreferenceResolver();

  @Test
  void inApp_takesEverything() {
    ResolvedPreference inApp =
        resolver.resolve(NotificationCategory.LOW_STOCK, NotificationChannel.IN_APP, List.of());

    assertThat(inApp.enabled()).isTrue();
    assertThat(inApp.minSeverity()).isEqualTo(NotificationSeverity.INFO);
  }

  /**
   * The floor that made six of eight categories unreachable. A single CRITICAL floor read as cost
   * discipline, but low stock — the first-ranked problem of fourteen of seventeen farmers surveyed
   * — is a WARNING, so it never left the app. What reaches a phone is now decided per category, by
   * where the person is when it matters.
   */
  @Test
  void whatsapp_fieldAlertsFireFromWarning() {
    for (NotificationCategory c :
        List.of(
            NotificationCategory.LOW_STOCK,
            NotificationCategory.MORTALITY_ANOMALY,
            NotificationCategory.WITHDRAWAL_ENDING,
            NotificationCategory.VACCINATION_LATE,
            NotificationCategory.CRITICAL_OBSERVATION,
            NotificationCategory.NEGATIVE_STOCK)) {
      ResolvedPreference r = resolver.resolve(c, NotificationChannel.WHATSAPP, List.of());
      assertThat(r.enabled()).as("%s enabled", c).isTrue();
      assertThat(r.minSeverity()).as("%s floor", c).isEqualTo(NotificationSeverity.WARNING);
    }
  }

  /** The desk side stays CRITICAL-only: the manager is already looking at the dashboard. */
  @Test
  void whatsapp_deskAlertsStayCriticalOnly() {
    for (NotificationCategory c :
        List.of(
            NotificationCategory.INVOICE_OVERDUE,
            NotificationCategory.CREDIT_EXCEEDED,
            NotificationCategory.PO_OVERDUE)) {
      ResolvedPreference r = resolver.resolve(c, NotificationChannel.WHATSAPP, List.of());
      assertThat(r.minSeverity()).as("%s floor", c).isEqualTo(NotificationSeverity.CRITICAL);
    }
  }

  /** Every category must have a stated floor — a new one added without a decision fails here. */
  @Test
  void whatsapp_everyCategoryHasAFloor() {
    for (NotificationCategory c : NotificationCategory.values()) {
      assertThat(resolver.resolve(c, NotificationChannel.WHATSAPP, List.of()).minSeverity())
          .as("%s", c)
          .isNotNull();
    }
  }

  /** A farmer who finds it noisy can still raise the floor back — the default is only a default. */
  @Test
  void override_canRaiseTheFloorBackToCritical() {
    NotificationPreference override = new NotificationPreference();
    override.setCategory(NotificationCategory.LOW_STOCK);
    override.setChannel(NotificationChannel.WHATSAPP);
    override.setEnabled(true);
    override.setMinSeverity(NotificationSeverity.CRITICAL);

    ResolvedPreference r =
        resolver.resolve(
            NotificationCategory.LOW_STOCK, NotificationChannel.WHATSAPP, List.of(override));

    assertThat(r.minSeverity()).isEqualTo(NotificationSeverity.CRITICAL);
  }

  @Test
  void override_turnsWhatsappOn_withMinSeverity() {
    NotificationPreference override = new NotificationPreference();
    override.setCategory(NotificationCategory.LOW_STOCK);
    override.setChannel(NotificationChannel.WHATSAPP);
    override.setEnabled(true);
    override.setMinSeverity(NotificationSeverity.CRITICAL);

    ResolvedPreference r =
        resolver.resolve(
            NotificationCategory.LOW_STOCK, NotificationChannel.WHATSAPP, List.of(override));

    assertThat(r.enabled()).isTrue();
    assertThat(r.minSeverity()).isEqualTo(NotificationSeverity.CRITICAL);
  }

  @Test
  void resolveAll_coversEveryCategoryAndChannel() {
    int expected = NotificationCategory.values().length * NotificationChannel.values().length;
    assertThat(resolver.resolveAll(List.of())).hasSize(expected);
  }
}
