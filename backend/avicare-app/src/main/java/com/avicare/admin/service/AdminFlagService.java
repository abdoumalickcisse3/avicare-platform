package com.avicare.admin.service;

import com.avicare.admin.dto.response.FeatureFlagRow;
import com.avicare.admin.dto.response.FlagHistoryEntry;
import com.avicare.admin.repository.AdminAuditLogRepository;
import com.avicare.subscription.flags.FeatureFlag;
import com.avicare.subscription.flags.FeatureFlagService;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Console-facing view over the platform switches.
 *
 * <p>Thin on purpose: the switches themselves belong to the gating context ({@link
 * FeatureFlagService}), which is what enforces them. This only shapes them for the screen and reads
 * the history back out of the audit trail.
 */
@Service
@RequiredArgsConstructor
public class AdminFlagService {

  private static final String FLAG_ACTION_PREFIX = "flag.";

  private final FeatureFlagService featureFlags;
  private final AdminAuditLogRepository auditLog;

  @Transactional(readOnly = true)
  public List<FeatureFlagRow> list() {
    LocalDateTime now = LocalDateTime.now();
    return featureFlags.list().stream().map(flag -> toRow(flag, now)).toList();
  }

  public FeatureFlagRow activate(String flagKey, String reason, Long actorUserId) {
    return toRow(
        featureFlags.activateKillswitch(flagKey, reason, actorUserId), LocalDateTime.now());
  }

  public FeatureFlagRow extend(String flagKey, Long actorUserId) {
    return toRow(featureFlags.extendKillswitch(flagKey, actorUserId), LocalDateTime.now());
  }

  public FeatureFlagRow lift(String flagKey, Long actorUserId) {
    return toRow(featureFlags.deactivateKillswitch(flagKey, actorUserId), LocalDateTime.now());
  }

  public FeatureFlagRow setEnabled(String flagKey, boolean enabled, Long actorUserId) {
    return toRow(
        featureFlags.setEnabledGlobally(flagKey, enabled, actorUserId), LocalDateTime.now());
  }

  /** The last 30 changes, whoever made them — including the sweep job. */
  @Transactional(readOnly = true)
  public List<FlagHistoryEntry> history() {
    return auditLog.findTop30ByActionStartingWithOrderByCreatedAtDesc(FLAG_ACTION_PREFIX).stream()
        .map(
            entry ->
                new FlagHistoryEntry(
                    entry.getAction().substring(FLAG_ACTION_PREFIX.length()),
                    str(entry.getMetadata().get("flagKey")),
                    str(entry.getMetadata().get("reason")),
                    entry.getActorUserId(),
                    entry.getCreatedAt()))
        .toList();
  }

  private static FeatureFlagRow toRow(FeatureFlag flag, LocalDateTime now) {
    Long remaining = null;
    if (flag.isKillswitchActive() && flag.getKillswitchExpiresAt() != null) {
      long seconds = Duration.between(now, flag.getKillswitchExpiresAt()).toSeconds();
      remaining = Math.max(seconds, 0);
    }
    return new FeatureFlagRow(
        flag.getFlagKey(),
        flag.isEnabledGlobally(),
        flag.isKillswitchActive(),
        flag.getKillswitchReason(),
        flag.getKillswitchBy(),
        flag.getKillswitchAt(),
        flag.getKillswitchExpiresAt(),
        remaining);
  }

  private static String str(Object value) {
    return value == null ? null : value.toString();
  }
}
