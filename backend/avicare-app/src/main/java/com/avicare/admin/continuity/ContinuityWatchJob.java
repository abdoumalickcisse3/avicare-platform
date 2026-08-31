package com.avicare.admin.continuity;

import com.avicare.admin.repository.AdminAuditLogRepository;
import com.avicare.admin.service.AdminAuditService;
import com.avicare.identity.repository.UserRepository;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notices when the person who runs the platform has not been seen for a while, and tells the
 * emergency contact.
 *
 * <p>A solo-operated platform has one failure mode nothing else covers: the operator. An accident,
 * a hospital stay, a family obligation — and a farm paying every month is left with an incident
 * nobody is looking at. This does not fix that; it makes sure somebody finds out.
 *
 * <p><b>No table of its own.</b> The heartbeat is already in {@code admin_audit_log}: every staff
 * sign-in and every staff action lands there with an actor and a timestamp, so "when was Malick
 * last seen" is a query, not a column to keep in step with reality. The same trail also records the
 * alerts this job sends, which is how it knows not to repeat itself — a warning that arrives every
 * hour is one the recipient mutes on the second day.
 *
 * <p><b>Any staff activity counts</b>, not only a sign-in. Somebody working through the console
 * with a session already open is plainly present, and a heartbeat that missed that would cry wolf
 * on a busy Tuesday.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ContinuityWatchJob {

  static final String SILENT_ACTION = "continuity.owner_silent";

  private final AdminAuditLogRepository auditLog;
  private final UserRepository users;
  private final AdminAuditService auditService;
  private final WhatsAppOutboxFacade whatsApp;

  @Value("${avicare.continuity.enabled:true}")
  private boolean enabled;

  /** How long a silence has to last before it means anything. Three days, by default. */
  @Value("${avicare.continuity.silence-hours:72}")
  private int silenceHours;

  /** How long before saying it again, while the silence continues. */
  @Value("${avicare.continuity.re-alert-hours:24}")
  private int reAlertHours;

  @Value("${avicare.admin.founder-email:}")
  private String founderEmail;

  /**
   * The person to warn — <b>not</b> the on-call number, which is the operator's own. Empty means
   * the watch runs and records but reaches nobody, which is said out loud at startup.
   */
  @Value("${avicare.admin.emergency-phone:}")
  private String emergencyPhone;

  @Scheduled(cron = "${avicare.continuity.cron:0 15 * * * *}")
  @Transactional
  public void checkOwnerHeartbeat() {
    if (!enabled || founderEmail == null || founderEmail.isBlank()) {
      return;
    }
    Optional<Long> founderId = users.findByEmailIgnoreCase(founderEmail.trim()).map(u -> u.getId());
    if (founderId.isEmpty()) {
      log.warn("Continuity watch: no account for founder email '{}'", founderEmail);
      return;
    }

    LocalDateTime lastSeen = lastActivityOf(founderId.get());
    if (lastSeen == null) {
      // Never seen at all: almost certainly a fresh deployment, not a missing person.
      return;
    }

    long hoursOfSilence = Duration.between(lastSeen, LocalDateTime.now()).toHours();
    if (hoursOfSilence < silenceHours) {
      return;
    }
    if (alertedRecently()) {
      return;
    }

    Map<String, Object> metadata = new HashMap<>();
    metadata.put("hoursOfSilence", hoursOfSilence);
    metadata.put("lastSeenAt", lastSeen.toString());
    metadata.put("automatic", true);
    auditService.record(null, SILENT_ACTION, "User", founderId.get(), null, metadata);

    log.warn("Continuity watch: platform owner not seen for {} h", hoursOfSilence);
    notifyEmergencyContact(hoursOfSilence, lastSeen);
  }

  /** The most recent thing the founder did, whatever it was. */
  private LocalDateTime lastActivityOf(Long founderId) {
    return auditLog
        .findByActorUserIdOrderByCreatedAtDesc(
            founderId, org.springframework.data.domain.PageRequest.of(0, 1))
        .stream()
        .findFirst()
        .map(entry -> entry.getCreatedAt())
        .orElse(null);
  }

  private boolean alertedRecently() {
    return auditLog.findTop30ByActionStartingWithOrderByCreatedAtDesc(SILENT_ACTION).stream()
        .findFirst()
        .map(entry -> entry.getCreatedAt())
        .filter(at -> at.isAfter(LocalDateTime.now().minusHours(reAlertHours)))
        .isPresent();
  }

  private void notifyEmergencyContact(long hoursOfSilence, LocalDateTime lastSeen) {
    if (emergencyPhone == null || emergencyPhone.isBlank()) {
      log.warn(
          "Continuity watch triggered but no emergency contact configured — set"
              + " ADMIN_EMERGENCY_PHONE. The alert was recorded and reaches nobody.");
      return;
    }
    whatsApp.enqueue(
        emergencyPhone,
        "⚠️ Jawdi — Malick n'a pas été vu sur la console depuis "
            + hoursOfSilence
            + " h (dernière activité : "
            + lastSeen.toLocalDate()
            + "). Prends de ses nouvelles. S'il est injoignable, la procédure est dans"
            + " docs/continuity/ du dépôt.");
  }
}
