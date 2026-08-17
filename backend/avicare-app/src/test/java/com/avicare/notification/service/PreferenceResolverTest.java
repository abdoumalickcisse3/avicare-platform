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
  void defaults_inAppOn_whatsappOff() {
    ResolvedPreference inApp =
        resolver.resolve(NotificationCategory.LOW_STOCK, NotificationChannel.IN_APP, List.of());
    ResolvedPreference whatsapp =
        resolver.resolve(NotificationCategory.LOW_STOCK, NotificationChannel.WHATSAPP, List.of());

    assertThat(inApp.enabled()).isTrue();
    assertThat(inApp.minSeverity()).isEqualTo(NotificationSeverity.INFO);
    assertThat(whatsapp.enabled()).isFalse();
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
