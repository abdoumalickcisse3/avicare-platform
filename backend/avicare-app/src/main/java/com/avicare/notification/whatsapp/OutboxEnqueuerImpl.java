package com.avicare.notification.whatsapp;

import com.avicare.identity.api.IdentityFacade;
import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationChannel;
import com.avicare.notification.domain.NotificationPreference;
import com.avicare.notification.repository.NotificationPreferenceRepository;
import com.avicare.notification.service.PreferenceResolver;
import com.avicare.notification.service.PreferenceResolver.ResolvedPreference;
import com.avicare.tenancy.api.TenancyFacade;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Fans a freshly materialized notification out to the WhatsApp outbox (Sprint C1 Phase 2): one
 * PENDING row per farm member who opted in for the WhatsApp channel at a {@code minSeverity} the
 * notification meets and who has a usable phone. No-op when WhatsApp is disabled. Runs inside the
 * scanner's transaction (the enqueue is transactional; the actual send is not — see {@link
 * WhatsAppDispatcher}).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxEnqueuerImpl implements OutboxEnqueuer {

  private final TenancyFacade tenancyFacade;
  private final IdentityFacade identityFacade;
  private final NotificationPreferenceRepository preferences;
  private final PreferenceResolver preferenceResolver;
  private final PhoneNormalizer phoneNormalizer;
  private final WhatsappOutboxRepository outbox;

  @Value("${notifications.whatsapp.enabled:false}")
  private boolean whatsappEnabled;

  @Override
  public void enqueueFor(Notification n) {
    if (!whatsappEnabled) {
      return;
    }
    for (Long userId : tenancyFacade.listMemberUserIds(n.getFarmId())) {
      List<NotificationPreference> overrides =
          preferences.findByFarmIdAndUserId(n.getFarmId(), userId);
      ResolvedPreference pref =
          preferenceResolver.resolve(n.getCategory(), NotificationChannel.WHATSAPP, overrides);
      if (!pref.enabled() || !n.getSeverity().atLeast(pref.minSeverity())) {
        continue;
      }
      String phone = phoneNormalizer.toKonekt(identityFacade.findById(userId).phone());
      if (phone == null) {
        continue;
      }
      WhatsappOutbox row = new WhatsappOutbox();
      row.setNotificationId(n.getId());
      row.setPhone(phone);
      row.setMessage(render(n));
      outbox.save(row);
    }
  }

  private static String render(Notification n) {
    return n.getBody() == null || n.getBody().isBlank()
        ? n.getTitle()
        : n.getTitle() + "\n" + n.getBody();
  }
}
