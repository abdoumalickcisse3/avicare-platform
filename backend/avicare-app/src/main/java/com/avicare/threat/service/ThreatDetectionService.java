package com.avicare.threat.service;

import com.avicare.threat.domain.BlockedIp;
import com.avicare.threat.domain.SecurityEvent;
import com.avicare.threat.domain.SecurityEventType;
import com.avicare.threat.domain.ThreatSeverity;
import com.avicare.threat.repository.BlockedIpRepository;
import com.avicare.threat.repository.SecurityEventRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Watches who is knocking, and shuts the door when it becomes obvious.
 *
 * <p><b>Reads are cached and fail open.</b> {@link #isBlocked} runs on every single request, so it
 * answers from a snapshot refreshed at most every {@value #CACHE_TTL_SECONDS} seconds, and a
 * database it cannot read means "not blocked". Same reasoning as the kill switch: a defence that
 * takes the platform down when its own table hiccups is worse than the attack it prevents. Blocking
 * an address refreshes the snapshot at once, so a real block lands immediately.
 *
 * <p><b>Blocks are always temporary.</b> A whole Senegalese town can share one operator NAT; a
 * permanent automatic block would eventually lock out a real farmer with nobody able to say why.
 * The block buys time against a script, it is not a verdict.
 *
 * <p><b>Recording runs in its own transaction.</b> A failed sign-in is recorded from inside {@code
 * AuthService.login}, which then throws — and an event that joined that transaction would be rolled
 * back with it. Every failure would vanish, and the detector would sit there counting to zero
 * forever. The same reasoning as {@code AdminAuditService}: the attempts worth remembering are
 * exactly the ones that ended badly.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ThreatDetectionService {

  static final int CACHE_TTL_SECONDS = 30;

  private final SecurityEventRepository events;
  private final BlockedIpRepository blockedIps;
  private final ThreatAlerter alerter;

  @Value("${avicare.security.bruteforce.max-failures:5}")
  private int maxFailures;

  @Value("${avicare.security.bruteforce.window-minutes:15}")
  private int windowMinutes;

  @Value("${avicare.security.bruteforce.block-minutes:60}")
  private int blockMinutes;

  @Value("${avicare.security.signup.max-per-hour:3}")
  private int maxSignupsPerHour;

  private volatile Snapshot snapshot = new Snapshot(Set.of(), 0L);

  /**
   * Rate-limit events are throttled in memory rather than counted in the table: under an actual
   * flood, one row (and one query) per rejected request is how the incident becomes a second
   * incident.
   */
  private final Map<String, Instant> lastRateLimitEvent = new ConcurrentHashMap<>();

  private record Snapshot(Set<String> blocked, long refreshedAtNanos) {}

  /** Whether {@code ip} is currently refused. Cheap, cached, and forgiving on failure. */
  public boolean isBlocked(String ip) {
    return currentlyBlocked().contains(ip);
  }

  /**
   * One failed sign-in. Records it, and blocks the address once the pattern is unmistakable.
   *
   * @param email what was typed — kept even when it matches no account, because guessing at
   *     addresses that do not exist is exactly what a script does
   */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void recordFailedLogin(String ip, String email, String userAgent) {
    LocalDateTime since = LocalDateTime.now().minusMinutes(windowMinutes);
    long recent = events.countRecent(ip, SecurityEventType.FAILED_LOGIN, since) + 1;

    Map<String, Object> details = new HashMap<>();
    details.put("attemptsInWindow", recent);
    details.put("windowMinutes", windowMinutes);

    boolean shouldBlock = recent >= maxFailures && !isBlocked(ip);
    save(
        SecurityEventType.FAILED_LOGIN,
        shouldBlock ? ThreatSeverity.WARNING : ThreatSeverity.INFO,
        ip,
        email,
        userAgent,
        details,
        null);

    if (shouldBlock) {
      String reason = recent + " échecs de connexion en " + windowMinutes + " min";
      block(ip, reason, "AUTO_BRUTEFORCE", Duration.ofMinutes(blockMinutes));
      save(
          SecurityEventType.BRUTEFORCE_DETECTED,
          ThreatSeverity.CRITICAL,
          ip,
          email,
          userAgent,
          details,
          "blocked");
      alerter.criticalThreat(reason, ip, email);
    }
  }

  /** A rejected request, recorded at most once a minute per address. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void recordRateLimitExceeded(String ip, String path) {
    Instant last = lastRateLimitEvent.get(ip);
    if (last != null && last.isAfter(Instant.now().minusSeconds(60))) {
      return;
    }
    lastRateLimitEvent.put(ip, Instant.now());
    save(
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        ThreatSeverity.INFO,
        ip,
        null,
        null,
        Map.of("path", path),
        "throttled");
  }

  /** Several accounts created from one address in an hour — worth a look, never an auto-block. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void recordSignup(String ip, String email) {
    long recent =
        events.countRecent(ip, SecurityEventType.SIGNUP_ANOMALY, LocalDateTime.now().minusHours(1));
    if (recent + 1 < maxSignupsPerHour) {
      // Below the bar: nothing to say. A farm signing up two accounts is not an event.
      return;
    }
    save(
        SecurityEventType.SIGNUP_ANOMALY,
        ThreatSeverity.WARNING,
        ip,
        email,
        null,
        Map.of("signupsInLastHour", recent + 1),
        "warned");
  }

  @Transactional
  public BlockedIp block(String ip, String reason, String by, Duration duration) {
    BlockedIp blocked = blockedIps.findById(ip).orElseGet(BlockedIp::new);
    blocked.setIpAddress(ip);
    blocked.setBlockedUntil(LocalDateTime.now().plus(duration));
    blocked.setReason(reason);
    blocked.setBlockedBy(by);
    blockedIps.save(blocked);
    invalidate();
    log.warn("IP {} blocked until {} — {}", ip, blocked.getBlockedUntil(), reason);
    alerter.ipBlockChanged(ip, true, reason, by);
    save(
        SecurityEventType.IP_BLOCKED,
        ThreatSeverity.WARNING,
        ip,
        null,
        null,
        Map.of("reason", reason),
        "blocked");
    return blocked;
  }

  @Transactional
  public void unblock(String ip, String by, String reason) {
    blockedIps.deleteById(ip);
    invalidate();
    alerter.ipBlockChanged(ip, false, reason, by);
    save(
        SecurityEventType.IP_UNBLOCKED,
        ThreatSeverity.INFO,
        ip,
        null,
        null,
        Map.of("reason", reason),
        null);
  }

  @Transactional(readOnly = true)
  public List<BlockedIp> activeBlocks() {
    return blockedIps.findByBlockedUntilAfterOrderByBlockedAtDesc(LocalDateTime.now());
  }

  @Transactional(readOnly = true)
  public List<SecurityEvent> recentEvents(int days) {
    return events.findTop200ByCreatedAtAfterOrderByCreatedAtDesc(
        LocalDateTime.now().minusDays(days));
  }

  @Transactional(readOnly = true)
  public Map<String, Long> counters(int days) {
    LocalDateTime since = LocalDateTime.now().minusDays(days);
    Map<String, Long> counters = new HashMap<>();
    counters.put(
        "critical", events.countBySeverityAndCreatedAtAfter(ThreatSeverity.CRITICAL, since));
    counters.put(
        "failedLogins",
        events.countByEventTypeAndCreatedAtAfter(SecurityEventType.FAILED_LOGIN, since));
    counters.put(
        "rateLimited",
        events.countByEventTypeAndCreatedAtAfter(SecurityEventType.RATE_LIMIT_EXCEEDED, since));
    counters.put("blockedNow", (long) activeBlocks().size());
    return counters;
  }

  private void save(
      SecurityEventType type,
      ThreatSeverity severity,
      String ip,
      String email,
      String userAgent,
      Map<String, Object> details,
      String actionTaken) {
    SecurityEvent event = new SecurityEvent();
    event.setEventType(type);
    event.setSeverity(severity);
    event.setIpAddress(ip);
    event.setEmail(email);
    event.setUserAgent(userAgent);
    event.setDetails(details == null ? Map.of() : details);
    event.setActionTaken(actionTaken);
    events.save(event);
  }

  private Set<String> currentlyBlocked() {
    Snapshot current = snapshot;
    if (System.nanoTime() - current.refreshedAtNanos() < CACHE_TTL_SECONDS * 1_000_000_000L) {
      return current.blocked();
    }
    return refresh();
  }

  private Set<String> refresh() {
    try {
      Set<String> blocked =
          blockedIps.findByBlockedUntilAfterOrderByBlockedAtDesc(LocalDateTime.now()).stream()
              .map(BlockedIp::getIpAddress)
              .collect(Collectors.toUnmodifiableSet());
      snapshot = new Snapshot(blocked, System.nanoTime());
      return blocked;
    } catch (RuntimeException e) {
      log.error("Could not read blocked IPs — letting every request through", e);
      return Set.of();
    }
  }

  private void invalidate() {
    snapshot = new Snapshot(snapshot.blocked(), 0L);
    refresh();
  }
}
