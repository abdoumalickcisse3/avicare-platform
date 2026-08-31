package com.avicare.admin.audit;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.threat.service.ThreatAlerter;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Back-office side of {@link ThreatAlerter}.
 *
 * <p>Blocks and releases land in the audit trail; only a confirmed attack reaches the on-call. A
 * single wrong password is a Tuesday, and a channel that reports those is a channel nobody reads.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdminThreatAlerter implements ThreatAlerter {

  private final AdminAuditService auditService;
  private final WhatsAppOutboxFacade whatsApp;

  @Value("${avicare.admin.oncall-phone:}")
  private String onCallPhone;

  @Override
  public void ipBlockChanged(String ip, boolean blocked, String reason, String by) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("ip", ip);
    metadata.put("reason", reason);
    metadata.put("by", by);
    if ("AUTO_BRUTEFORCE".equals(by)) {
      metadata.put("automatic", true);
    }
    auditService.record(
        null,
        blocked ? "security.ip.blocked" : "security.ip.unblocked",
        "Ip",
        null,
        null,
        metadata);
  }

  @Override
  public void criticalThreat(String summary, String ip, String email) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("ip", ip);
    metadata.put("summary", summary);
    if (email != null) {
      metadata.put("email", email);
    }
    metadata.put("automatic", true);
    auditService.record(null, "security.bruteforce", "Ip", null, null, metadata);

    if (onCallPhone == null || onCallPhone.isBlank()) {
      log.warn("Brute force from {} ({}) — no on-call phone configured", ip, summary);
      return;
    }
    whatsApp.enqueue(
        onCallPhone,
        "🔐 Jawdi — tentative d'intrusion depuis "
            + ip
            + " : "
            + summary
            + ". Adresse bloquée automatiquement. Détail dans /console/securite.");
  }
}
