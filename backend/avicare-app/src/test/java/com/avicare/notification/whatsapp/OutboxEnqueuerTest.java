package com.avicare.notification.whatsapp;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationChannel;
import com.avicare.notification.domain.NotificationPreference;
import com.avicare.notification.domain.NotificationSeverity;
import com.avicare.notification.repository.NotificationPreferenceRepository;
import com.avicare.notification.service.PreferenceResolver;
import com.avicare.tenancy.api.TenancyFacade;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class OutboxEnqueuerTest {

  @Mock TenancyFacade tenancyFacade;
  @Mock IdentityFacade identityFacade;
  @Mock NotificationPreferenceRepository preferences;
  @Mock WhatsappOutboxRepository outbox;

  private OutboxEnqueuerImpl enqueuer(boolean enabled) {
    OutboxEnqueuerImpl e =
        new OutboxEnqueuerImpl(
            tenancyFacade,
            identityFacade,
            preferences,
            new PreferenceResolver(),
            new PhoneNormalizer("221"),
            outbox);
    ReflectionTestUtils.setField(e, "whatsappEnabled", enabled);
    return e;
  }

  private Notification withSeverity(NotificationSeverity severity) {
    Notification n = new Notification();
    n.setFarmId(1L);
    n.setCategory(NotificationCategory.NEGATIVE_STOCK);
    n.setSeverity(severity);
    n.setTitle("Stock négatif");
    n.setBody("détail");
    return n;
  }

  private Notification critical() {
    return withSeverity(NotificationSeverity.CRITICAL);
  }

  private UserInfo userWithPhone() {
    return new UserInfo(10L, "u@test.io", "U", "770000000", UserRole.USER, true);
  }

  private NotificationPreference whatsappOn() {
    NotificationPreference p = new NotificationPreference();
    p.setCategory(NotificationCategory.NEGATIVE_STOCK);
    p.setChannel(NotificationChannel.WHATSAPP);
    p.setEnabled(true);
    p.setMinSeverity(NotificationSeverity.WARNING);
    return p;
  }

  @Test
  void enqueues_whenMemberOptedInAndSeverityMet() {
    when(tenancyFacade.listMemberUserIds(1L)).thenReturn(List.of(10L));
    when(preferences.findByFarmIdAndUserId(1L, 10L)).thenReturn(List.of(whatsappOn()));
    when(identityFacade.findById(10L)).thenReturn(userWithPhone());

    enqueuer(true).enqueueFor(critical());

    verify(outbox)
        .save(
            org.mockito.ArgumentMatchers.argThat(
                r ->
                    r.getPhone().equals("221770000000")
                        && r.getMessage().contains("Stock négatif")));
  }

  @Test
  void enqueues_criticalByDefault_withoutAnyOverride() {
    // Default WhatsApp preference: on, floored at CRITICAL — a CRITICAL alert reaches WhatsApp
    // even with no stored override, as long as the member has a phone.
    when(tenancyFacade.listMemberUserIds(1L)).thenReturn(List.of(10L));
    when(preferences.findByFarmIdAndUserId(1L, 10L)).thenReturn(List.of());
    when(identityFacade.findById(10L)).thenReturn(userWithPhone());

    enqueuer(true).enqueueFor(critical());

    verify(outbox).save(any());
  }

  @Test
  void skips_warningByDefault_belowCriticalFloor() {
    when(tenancyFacade.listMemberUserIds(1L)).thenReturn(List.of(10L));
    when(preferences.findByFarmIdAndUserId(1L, 10L)).thenReturn(List.of());

    enqueuer(true).enqueueFor(withSeverity(NotificationSeverity.WARNING));

    verify(outbox, never()).save(any());
  }

  @Test
  void skips_whenWhatsappGloballyDisabled() {
    enqueuer(false).enqueueFor(critical());
    verify(outbox, never()).save(any());
  }
}
