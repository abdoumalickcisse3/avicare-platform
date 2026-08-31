package com.avicare.subscription.flags;

import com.avicare.common.api.exception.NotFoundException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Platform-wide switches: the emergency stop the per-farm gating cannot provide.
 *
 * <p><b>Reads are cached and fail open.</b> {@link #isBlocked} sits on the hot path of every gated
 * request, so it answers from a snapshot refreshed at most every {@value #CACHE_TTL_SECONDS}
 * seconds, and any failure to read the table is treated as "not blocked". Failing closed would mean
 * a database hiccup takes the whole platform down — a kill switch that causes outages is worse than
 * the bug it was built to contain. The cost is bounded: a cut takes effect within the cache window,
 * and every write refreshes the snapshot immediately, so in practice it is instant.
 *
 * <p>A cut expires on its own. The sweep below is the tidy-up; {@link FeatureFlag#blocking} already
 * stops honouring a lapsed cut on read, so the window is respected to the second either way.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FeatureFlagService {

  static final int CACHE_TTL_SECONDS = 30;

  /** How long a cut lasts before it lifts itself, unless someone extends it. */
  public static final Duration KILLSWITCH_WINDOW = Duration.ofMinutes(30);

  private final FeatureFlagRepository repository;
  private final FlagChangeRecorder changeRecorder;

  @Value("${avicare.flags.enabled:true}")
  private boolean flagsEnabled;

  private volatile Snapshot snapshot = new Snapshot(Map.of(), 0L);

  /** Blocked flag key to the reason given for it ({@code ""} when there is none). */
  private record Snapshot(Map<String, String> blocked, long refreshedAtNanos) {}

  /** Whether {@code flagKey} is currently switched off platform-wide. */
  public boolean isBlocked(String flagKey) {
    if (!flagsEnabled) {
      return false;
    }
    return currentlyBlocked().containsKey(flagKey);
  }

  /**
   * Why {@code flagKey} is cut, when it is and a reason was given. Surfaced to the caller in the
   * 503 so the farmer is told "stock entry is paused while we fix a counting bug", not just
   * "unavailable".
   */
  public String reasonFor(String flagKey) {
    String reason = currentlyBlocked().get(flagKey);
    return reason == null || reason.isBlank() ? null : reason;
  }

  @Transactional(readOnly = true)
  public List<FeatureFlag> list() {
    return repository.findAllByOrderByFlagKeyAsc();
  }

  /**
   * Cut a feature for everyone. The reason is mandatory: whoever finds the platform in this state
   * at 3am — including a future you — needs to know what it is protecting them from.
   */
  @Transactional
  public FeatureFlag activateKillswitch(String flagKey, String reason, Long actorUserId) {
    FeatureFlag flag = require(flagKey);
    LocalDateTime now = LocalDateTime.now();
    flag.setKillswitchActive(true);
    flag.setKillswitchReason(reason);
    flag.setKillswitchBy(actorUserId);
    flag.setKillswitchAt(now);
    flag.setKillswitchExpiresAt(now.plus(KILLSWITCH_WINDOW));
    repository.save(flag);
    invalidate();
    log.warn("KILL SWITCH ON for {} by user {} — {}", flagKey, actorUserId, reason);
    changeRecorder.record(flagKey, "killswitch", actorUserId, reason, true);
    return flag;
  }

  /** Push the expiry back, for a fix that is taking longer than the first window allowed. */
  @Transactional
  public FeatureFlag extendKillswitch(String flagKey, Long actorUserId) {
    FeatureFlag flag = require(flagKey);
    flag.setKillswitchExpiresAt(LocalDateTime.now().plus(KILLSWITCH_WINDOW));
    repository.save(flag);
    invalidate();
    changeRecorder.record(
        flagKey, "killswitch.extend", actorUserId, flag.getKillswitchReason(), false);
    return flag;
  }

  /** Lift a cut before its window closes. */
  @Transactional
  public FeatureFlag deactivateKillswitch(String flagKey, Long actorUserId) {
    FeatureFlag flag = require(flagKey);
    clearKillswitch(flag);
    repository.save(flag);
    invalidate();
    log.warn("KILL SWITCH OFF for {} by user {}", flagKey, actorUserId);
    changeRecorder.record(flagKey, "killswitch.lift", actorUserId, null, true);
    return flag;
  }

  /** The standing switch — not an emergency, so no reason, no expiry, no notification. */
  @Transactional
  public FeatureFlag setEnabledGlobally(String flagKey, boolean enabled, Long actorUserId) {
    FeatureFlag flag = require(flagKey);
    flag.setEnabledGlobally(enabled);
    repository.save(flag);
    invalidate();
    changeRecorder.record(
        flagKey, enabled ? "global.enable" : "global.disable", actorUserId, null, false);
    return flag;
  }

  /** Lifts the cuts whose window has closed. */
  @Scheduled(cron = "${avicare.flags.sweep-cron:0 */5 * * * *}")
  @Transactional
  public void sweepExpiredKillswitches() {
    List<FeatureFlag> expired =
        repository.findByKillswitchActiveTrueAndKillswitchExpiresAtBefore(LocalDateTime.now());
    for (FeatureFlag flag : expired) {
      clearKillswitch(flag);
      repository.save(flag);
      log.warn("KILL SWITCH EXPIRED for {} — feature served again", flag.getFlagKey());
      changeRecorder.record(flag.getFlagKey(), "killswitch.expire", null, null, true);
    }
    if (!expired.isEmpty()) {
      invalidate();
    }
  }

  private static void clearKillswitch(FeatureFlag flag) {
    flag.setKillswitchActive(false);
    flag.setKillswitchReason(null);
    flag.setKillswitchBy(null);
    flag.setKillswitchAt(null);
    flag.setKillswitchExpiresAt(null);
  }

  private FeatureFlag require(String flagKey) {
    return repository
        .findByFlagKey(flagKey)
        .orElseThrow(() -> NotFoundException.of("Flag", flagKey));
  }

  private Map<String, String> currentlyBlocked() {
    Snapshot current = snapshot;
    if (System.nanoTime() - current.refreshedAtNanos() < CACHE_TTL_SECONDS * 1_000_000_000L) {
      return current.blocked();
    }
    return refresh();
  }

  private Map<String, String> refresh() {
    try {
      LocalDateTime now = LocalDateTime.now();
      Map<String, String> blocked =
          repository.findAll().stream()
              .filter(flag -> flag.blocking(now))
              .collect(
                  Collectors.toUnmodifiableMap(
                      FeatureFlag::getFlagKey,
                      flag ->
                          flag.getKillswitchReason() == null ? "" : flag.getKillswitchReason()));
      snapshot = new Snapshot(blocked, System.nanoTime());
      return blocked;
    } catch (RuntimeException e) {
      // Fail open, loudly. See the class javadoc: an unreadable flag table must not become an
      // outage of its own.
      log.error("Could not read feature flags — serving every feature as enabled", e);
      return Map.of();
    }
  }

  /** Forces the next read to hit the table, so a cut takes effect at once. */
  private void invalidate() {
    snapshot = new Snapshot(snapshot.blocked(), 0L);
    refresh();
  }
}
