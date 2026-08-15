package com.avicare.assistant.confirm;

import com.avicare.assistant.audit.AssistantAuditService;
import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The assistant's ADDITIONAL, server-side confirm path (pattern §5): a write DRAFT is stored as a
 * short-lived claim; a later {@code /assistant/confirm} executes it via a {@link DraftExecutor}
 * before it expires. This coexists with the mobile client-held flow — it does not replace it.
 *
 * <p>Execute + delete are atomic (one transaction) so a confirmed action can never run twice; the
 * audit trace is written best-effort outside that transaction (controller for CONFIRMED, the sweep
 * for EXPIRED) so it can never poison the write.
 */
@Service
public class PendingActionService {

  private static final Logger log = LoggerFactory.getLogger(PendingActionService.class);

  private final PendingActionRepository repository;
  private final DraftExecutorRegistry executors;
  private final AssistantAuditService audit;
  private final int ttlMinutes;

  public PendingActionService(
      PendingActionRepository repository,
      DraftExecutorRegistry executors,
      AssistantAuditService audit,
      @Value("${assistant.confirm-ttl-minutes:5}") int ttlMinutes) {
    this.repository = repository;
    this.executors = executors;
    this.audit = audit;
    this.ttlMinutes = ttlMinutes;
  }

  /**
   * Store a DRAFT as a claim and return its id (put in the response for a server-confirm client).
   */
  public String claim(Long farmId, Long userId, InterpretResponse draft) {
    PendingAction row = new PendingAction();
    row.setClaimId(UUID.randomUUID().toString());
    row.setFarmId(farmId);
    row.setUserId(userId);
    row.setAction(draft.action());
    row.setFields(draft.fields() == null ? Map.of() : draft.fields());
    row.setSummary(draft.summary());
    row.setRisk(draft.risk());
    row.setExpiresAt(LocalDateTime.now().plusMinutes(ttlMinutes));
    return repository.save(row).getClaimId();
  }

  /** Result of a confirm: the executed action and its summary, for the CONFIRMED audit trace. */
  public record ConfirmResult(String action, String summary) {}

  /**
   * Execute the claim's action and delete it, atomically. Refuses an unknown, foreign, expired, or
   * unsupported claim. The CONFIRMED audit is left to the caller (after commit).
   */
  @Transactional
  public ConfirmResult confirm(Long farmId, Long userId, String claimId) {
    PendingAction claim =
        repository
            .findByClaimId(claimId)
            .filter(c -> c.getFarmId().equals(farmId) && c.getUserId().equals(userId))
            .orElseThrow(() -> NotFoundException.of("Confirmation", claimId));

    if (claim.getExpiresAt().isBefore(LocalDateTime.now())) {
      repository.delete(claim);
      throw new BusinessRuleException(
          "ASSISTANT_CLAIM_EXPIRED", "Cette confirmation a expiré. Recommencez la demande.");
    }

    DraftExecutor executor =
        executors
            .find(claim.getAction())
            .orElseThrow(
                () ->
                    new BusinessRuleException(
                        "ASSISTANT_ACTION_UNSUPPORTED",
                        "Action non exécutable côté serveur : " + claim.getAction()));

    executor.execute(farmId, userId, claim.getFields());
    repository.delete(claim); // atomic with the write — a confirmed action never runs twice
    return new ConfirmResult(claim.getAction(), claim.getSummary());
  }

  /**
   * Sweep expired, unconfirmed claims, tracing each EXPIRED. Independent per claim (best-effort).
   */
  @Scheduled(fixedDelayString = "${assistant.confirm-sweep-ms:300000}")
  public void sweepExpired() {
    List<PendingAction> expired = repository.findByExpiresAtBefore(LocalDateTime.now());
    for (PendingAction claim : expired) {
      try {
        audit.recordAction(
            claim.getFarmId(), claim.getUserId(), claim.getAction(), "EXPIRED", claim.getSummary());
        repository.delete(claim);
      } catch (RuntimeException e) {
        log.warn("Sweep of pending claim {} failed ({})", claim.getClaimId(), e.toString());
      }
    }
  }
}
