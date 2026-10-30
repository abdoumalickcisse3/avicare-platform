package com.avicare.integrity.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.integrity.domain.IntegrityFinding;
import com.avicare.integrity.domain.Severity;
import com.avicare.integrity.repository.IntegrityFindingRepository;
import java.util.EnumMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What a human does with a finding: look at it, correct it, or decide it is acceptable.
 *
 * <p>All three closing paths demand a written note. The value of this screen is that six months
 * from now, someone can tell a corrected defect from an accepted one and know why — a finding
 * closed with no explanation is a finding that will be re-opened, re-investigated and re-closed.
 */
@Service
@RequiredArgsConstructor
public class IntegrityFindingService {

  private final IntegrityFindingRepository repository;
  private final RecomputeService recomputeService;
  private final IntegrityAlerter alerter;
  private final IntegrityCheckService checkService;

  @Transactional(readOnly = true)
  public Page<IntegrityFinding> openFindings(Pageable pageable) {
    return repository.findByResolvedAtIsNullOrderBySeverityDescDetectedAtDesc(pageable);
  }

  @Transactional(readOnly = true)
  public Map<Severity, Long> openCounts() {
    Map<Severity, Long> counts = new EnumMap<>(Severity.class);
    for (Severity severity : Severity.values()) {
      counts.put(severity, repository.countBySeverityAndResolvedAtIsNull(severity));
    }
    return counts;
  }

  /** What the recompute would change, without changing it. Always the first thing shown. */
  @Transactional
  public RecomputeResult preview(Long findingId) {
    IntegrityFinding finding = open(findingId);
    refuseIfTheCheckSaysItWouldMeanNothing(finding);
    return recomputeService.recompute(finding.getEntityType(), finding.getEntityId(), true);
  }

  /**
   * Recompute for real, then close the finding.
   *
   * <p>Refuses a no-op: if the figure is already right, the finding is stale and closing it as
   * "recomputed" would put a repair in the trail that never happened.
   */
  @Transactional
  public RecomputeResult applyRecompute(Long findingId, String reason, Long actorUserId) {
    requireReason(reason);
    IntegrityFinding finding = open(findingId);
    refuseIfTheCheckSaysItWouldMeanNothing(finding);
    RecomputeResult preview =
        recomputeService.recompute(finding.getEntityType(), finding.getEntityId(), true);
    if (!preview.changesSomething()) {
      throw new BusinessRuleException(
          "RECOMPUTE_NO_CHANGE",
          "The figure already matches — nothing to recompute. Re-run the checks to close it.");
    }
    RecomputeResult applied =
        recomputeService.recompute(finding.getEntityType(), finding.getEntityId(), false);
    close(finding, "recomputed", actorUserId, reason);
    return applied;
  }

  /** The drift is real and we choose to live with it. */
  @Transactional
  public IntegrityFinding acceptDrift(Long findingId, String reason, Long actorUserId) {
    requireReason(reason);
    IntegrityFinding finding = open(findingId);
    close(finding, "accepted_drift", actorUserId, reason);
    return finding;
  }

  /** It was corrected through the application itself, not by this screen. */
  @Transactional
  public IntegrityFinding markManuallyFixed(Long findingId, String reason, Long actorUserId) {
    requireReason(reason);
    IntegrityFinding finding = open(findingId);
    close(finding, "manual_fix", actorUserId, reason);
    return finding;
  }

  private void close(IntegrityFinding finding, String action, Long actorUserId, String reason) {
    finding.resolve(action, actorUserId, reason);
    alerter.findingResolved(finding.getId(), finding.getCheckKey(), action, actorUserId, reason);
  }

  private IntegrityFinding open(Long findingId) {
    IntegrityFinding finding =
        repository
            .findById(findingId)
            .orElseThrow(() -> NotFoundException.of("Finding", findingId));
    if (!finding.isOpen()) {
      throw new BusinessRuleException(
          "FINDING_ALREADY_RESOLVED",
          "This finding was already closed as " + finding.getResolutionAction());
    }
    return finding;
  }

  /**
   * Some findings have a recomputable entity type and nothing to gain from recomputing it.
   *
   * <p>A negative stock is the case: its type is {@code stock_item}, whose quantity <i>is</i>
   * derived — but the figure a recompute puts back is the last movement's, which is negative too.
   * The console hides the button for these; this is the rule itself, and the screen merely reflects
   * it. A flag the front end chooses to honour is not a rule: refusing here is what makes it one.
   */
  private void refuseIfTheCheckSaysItWouldMeanNothing(IntegrityFinding finding) {
    if (!checkService.isRecomputable(finding.getCheckKey())) {
      throw new BusinessRuleException(
          "RECOMPUTE_NOT_SUPPORTED",
          "Recomputing a "
              + finding.getCheckKey()
              + " finding would put back the same figure — the correction is a decision, not an"
              + " arithmetic operation");
    }
  }

  private static void requireReason(String reason) {
    if (reason == null || reason.isBlank()) {
      throw new BusinessRuleException(
          "REASON_REQUIRED", "Closing a finding requires saying why, in words");
    }
  }
}
