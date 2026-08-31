package com.avicare.admin.audit;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.subscription.flags.FlagChangeRecorder;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Back-office side of {@link FlagChangeRecorder}: every flag change lands in the append-only trail,
 * and the ones that change what the platform is serving also reach whoever is on call.
 *
 * <p>WhatsApp, not Slack: it is the channel this platform already speaks (Konekt outbox, retry,
 * dispatcher), and the person on call in Dakar reads it on their phone. Leaving {@code
 * avicare.admin.oncall-phone} empty disables the notification without disabling the trail — a
 * missing phone number must not cost us the audit entry.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdminFlagChangeRecorder implements FlagChangeRecorder {

  private final AdminAuditService auditService;
  private final WhatsAppOutboxFacade whatsApp;

  @Value("${avicare.admin.oncall-phone:}")
  private String onCallPhone;

  @Override
  public void record(
      String flagKey, String action, Long actorUserId, String reason, boolean urgent) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("flagKey", flagKey);
    if (reason != null && !reason.isBlank()) {
      metadata.put("reason", reason);
    }
    if (actorUserId == null) {
      // The sweep job acts with nobody behind it; say so rather than leave the reader guessing.
      metadata.put("automatic", true);
    }

    auditService.record(actorUserId, "flag." + action, "FeatureFlag", null, null, metadata);

    if (urgent) {
      notifyOnCall(flagKey, action, reason);
    }
  }

  private void notifyOnCall(String flagKey, String action, String reason) {
    if (onCallPhone == null || onCallPhone.isBlank()) {
      log.warn("Flag {} {} — no on-call phone configured, nobody was notified", flagKey, action);
      return;
    }
    String message =
        switch (action) {
          case "killswitch" ->
              "🚨 Jawdi — coupure d'urgence sur "
                  + flagKey
                  + (reason == null || reason.isBlank() ? "" : " : " + reason)
                  + ". Expire dans 30 min sauf prolongation.";
          case "killswitch.lift" -> "✅ Jawdi — coupure levée sur " + flagKey + ".";
          case "killswitch.expire" ->
              "⏱️ Jawdi — la coupure sur "
                  + flagKey
                  + " a expiré, la fonctionnalité est de nouveau servie.";
          default -> "Jawdi — " + flagKey + " : " + action;
        };
    whatsApp.enqueue(onCallPhone, message);
  }
}
