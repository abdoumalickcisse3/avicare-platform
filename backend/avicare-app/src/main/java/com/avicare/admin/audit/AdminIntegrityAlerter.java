package com.avicare.admin.audit;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.integrity.service.IntegrityAlerter;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Back-office side of {@link IntegrityAlerter}: findings reach the audit trail, and the ones that
 * mean money is wrong reach whoever is on call.
 *
 * <p>Only CRITICAL is worth a message, and only the first time it is seen — the sweep runs nightly,
 * and an alert that repeats until someone fixes it is an alert people learn to swipe away. A quiet
 * night sends nothing at all: silence has to keep meaning "nothing is wrong".
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdminIntegrityAlerter implements IntegrityAlerter {

  private final AdminAuditService auditService;
  private final WhatsAppOutboxFacade whatsApp;

  @Value("${avicare.admin.oncall-phone:}")
  private String onCallPhone;

  @Override
  public void sweepCompleted(int checksRun, int opened, int resolved, int criticalOpened) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("checksRun", checksRun);
    metadata.put("opened", opened);
    metadata.put("resolved", resolved);
    metadata.put("criticalOpened", criticalOpened);
    metadata.put("automatic", true);
    auditService.record(null, "integrity.sweep", "IntegritySweep", null, null, metadata);
  }

  @Override
  public void criticalFound(
      String checkKey, String label, String entityType, Long entityId, Long farmId) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("checkKey", checkKey);
    metadata.put("entity", entityType + "#" + entityId);
    metadata.put("automatic", true);
    auditService.record(null, "integrity.critical", entityType, entityId, farmId, metadata);

    if (onCallPhone == null || onCallPhone.isBlank()) {
      log.warn(
          "Integrity CRITICAL {} on {}#{} — no on-call phone configured",
          checkKey,
          entityType,
          entityId);
      return;
    }
    whatsApp.enqueue(
        onCallPhone,
        "⚠️ Jawdi — incohérence critique : "
            + label
            + " ("
            + entityType
            + " #"
            + entityId
            + (farmId == null ? "" : ", ferme " + farmId)
            + "). À voir dans /console/integrite.");
  }

  @Override
  public void findingResolved(
      Long findingId, String checkKey, String action, Long actorUserId, String notes) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("checkKey", checkKey);
    metadata.put("action", action);
    if (notes != null && !notes.isBlank()) {
      metadata.put("reason", notes);
    }
    auditService.record(
        actorUserId, "integrity." + action, "IntegrityFinding", findingId, null, metadata);
  }
}
