package com.avicare.integrity.service;

import com.avicare.integrity.check.FindingCandidate;
import com.avicare.integrity.check.IntegrityCheck;
import com.avicare.integrity.domain.IntegrityFinding;
import com.avicare.integrity.domain.Severity;
import com.avicare.integrity.repository.IntegrityFindingRepository;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs every invariant and keeps the finding list in step with reality.
 *
 * <p>Three rules make the output trustworthy enough to act on:
 *
 * <ol>
 *   <li><b>One row per claim.</b> A defect still present tomorrow updates its finding rather than
 *       adding a second one — otherwise a single unfixed bug buries the console in a week.
 *   <li><b>It closes itself.</b> A finding whose condition no longer holds is resolved as {@code
 *       auto_resolved}. Drift that corrected itself is worth knowing about; drift that lingers on
 *       the screen after being fixed teaches people to ignore the screen.
 *   <li><b>A grace window.</b> Anything written in the last few minutes is out of scope: a farm
 *       mid-transaction is not a defect.
 * </ol>
 *
 * <p>A failing check never stops the others: a broken query is a bug in the checker, not a reason
 * to skip the invariants that still work.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IntegrityCheckService {

  private final List<IntegrityCheck> checks;
  private final IntegrityFindingRepository repository;
  private final IntegrityAlerter alerter;

  @Value("${avicare.integrity.grace-minutes:15}")
  private int graceMinutes;

  /** What one sweep did, for the console and the logs. */
  public record SweepReport(int checksRun, int opened, int stillOpen, int resolved, int failed) {}

  @Transactional
  public SweepReport runAllChecks() {
    LocalDateTime cutoff = LocalDateTime.now().minusMinutes(graceMinutes);
    int opened = 0;
    int stillOpen = 0;
    int resolved = 0;
    int failed = 0;

    for (IntegrityCheck check : checks) {
      try {
        Outcome outcome = reconcile(check, cutoff);
        opened += outcome.opened();
        stillOpen += outcome.stillOpen();
        resolved += outcome.resolved();
      } catch (RuntimeException e) {
        failed++;
        log.error("Integrity check {} failed to run", check.key(), e);
      }
    }

    log.info(
        "Integrity sweep: {} check(s), {} opened, {} still open, {} resolved, {} failed",
        checks.size(),
        opened,
        stillOpen,
        resolved,
        failed);
    return new SweepReport(checks.size(), opened, stillOpen, resolved, failed);
  }

  private record Outcome(int opened, int stillOpen, int resolved) {}

  private Outcome reconcile(IntegrityCheck check, LocalDateTime cutoff) {
    List<FindingCandidate> candidates = check.run(cutoff);
    Set<String> seen = new HashSet<>();
    int opened = 0;
    int stillOpen = 0;

    for (FindingCandidate candidate : candidates) {
      seen.add(identity(candidate.entityType(), candidate.entityId()));
      IntegrityFinding existing =
          repository
              .findByCheckKeyAndEntityTypeAndEntityIdAndResolvedAtIsNull(
                  check.key(), candidate.entityType(), candidate.entityId())
              .orElse(null);

      if (existing == null) {
        repository.save(newFinding(check, candidate));
        opened++;
      } else {
        // Same defect, possibly a different amount by now: refresh the numbers, keep the row and
        // its detected_at so the console can show how long it has been wrong.
        existing.setSeverity(check.severity());
        existing.setExpectedValue(candidate.expectedValue());
        existing.setActualValue(candidate.actualValue());
        existing.setDetails(candidate.details() == null ? Map.of() : candidate.details());
        existing.setLastSeenAt(LocalDateTime.now());
        stillOpen++;
      }
    }

    int resolved = 0;
    for (IntegrityFinding open : repository.findByCheckKeyAndResolvedAtIsNull(check.key())) {
      if (!seen.contains(identity(open.getEntityType(), open.getEntityId()))) {
        open.resolve("auto_resolved", null, "La condition n'est plus vraie au passage suivant.");
        resolved++;
      }
    }
    return new Outcome(opened, stillOpen, resolved);
  }

  /** Tells the on-call about CRITICAL findings nobody has been told about yet — once each. */
  @Transactional
  public int notifyNewCriticals() {
    List<IntegrityFinding> pending =
        repository.findBySeverityAndResolvedAtIsNullAndNotifiedAtIsNull(Severity.CRITICAL);
    for (IntegrityFinding finding : pending) {
      alerter.criticalFound(
          finding.getCheckKey(),
          labelOf(finding.getCheckKey()),
          finding.getEntityType(),
          finding.getEntityId(),
          finding.getFarmId());
      // Stamped whatever happens downstream: a notification that fails must not turn into one that
      // repeats every night.
      finding.setNotifiedAt(LocalDateTime.now());
    }
    return pending.size();
  }

  public List<IntegrityCheck> catalogue() {
    return List.copyOf(checks);
  }

  public String labelOf(String checkKey) {
    return checks.stream()
        .filter(c -> c.key().equals(checkKey))
        .map(IntegrityCheck::label)
        .findFirst()
        .orElse(checkKey);
  }

  private static IntegrityFinding newFinding(IntegrityCheck check, FindingCandidate candidate) {
    IntegrityFinding finding = new IntegrityFinding();
    finding.setCheckKey(check.key());
    finding.setSeverity(check.severity());
    finding.setEntityType(candidate.entityType());
    finding.setEntityId(candidate.entityId());
    finding.setFarmId(candidate.farmId());
    finding.setExpectedValue(candidate.expectedValue());
    finding.setActualValue(candidate.actualValue());
    finding.setDetails(candidate.details() == null ? Map.of() : candidate.details());
    finding.setLastSeenAt(LocalDateTime.now());
    return finding;
  }

  private static String identity(String entityType, Long entityId) {
    return entityType + "#" + entityId;
  }
}
