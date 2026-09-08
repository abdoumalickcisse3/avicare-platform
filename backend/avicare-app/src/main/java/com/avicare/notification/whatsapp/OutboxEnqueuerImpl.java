package com.avicare.notification.whatsapp;

import com.avicare.identity.api.IdentityFacade;
import com.avicare.notification.domain.Notification;
import com.avicare.notification.domain.NotificationChannel;
import com.avicare.notification.domain.NotificationPreference;
import com.avicare.notification.repository.NotificationPreferenceRepository;
import com.avicare.notification.service.PreferenceResolver;
import com.avicare.notification.service.PreferenceResolver.ResolvedPreference;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
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
    /*
     * Read once, not per member: the farm name is the same for everyone on the message.
     *
     * Contained, because this runs inside the scanner's transaction: a farm that cannot be
     * resolved must cost one silent message, never the whole scan. And a message that cannot say
     * which farm it is about is worse than no message — an unknown number telling someone their
     * birds are dying is a message people distrust.
     */
    String farmName = farmName(n.getFarmId());
    if (farmName == null) {
      log.warn("Skipping WhatsApp fan-out: farm {} could not be named", n.getFarmId());
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
      row.setMessage(render(n, farmName));
      outbox.save(row);
    }
  }

  /**
   * The message as it lands on a phone.
   *
   * <p>It opens with the farm, because it arrives among family messages hours after anyone looked
   * at the app, and a farmer may run more than one. "Stock bas : Maïs" alone does not say where.
   * It closes by naming the app, so the recipient knows who is writing and where to act — a
   * message from an unknown number that tells you a lot is dying is a message people distrust.
   */
  /** The farm's name, or {@code null} when it cannot be resolved — never an exception. */
  private String farmName(Long farmId) {
    try {
      FarmInfo farm = tenancyFacade.findById(farmId);
      return farm == null || farm.name() == null || farm.name().isBlank() ? null : farm.name();
    } catch (RuntimeException e) {
      return null;
    }
  }

  private static String render(Notification n, String farmName) {
    StringBuilder sb = new StringBuilder();
    sb.append("*").append(farmName).append("*\n\n").append(n.getTitle());
    if (n.getBody() != null && !n.getBody().isBlank()) {
      sb.append("\n").append(n.getBody());
    }
    return sb.append("\n\n_Jawdi — ouvrez l'application pour agir._").toString();
  }
}
