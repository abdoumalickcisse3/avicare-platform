package com.avicare.admin.service;

import com.avicare.assistant.access.AssistantAvailability;
import com.avicare.assistant.audit.AssistantAudit;
import com.avicare.assistant.audit.AssistantAuditRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reading what the assistant actually answered (console Phase 5, differentiator L).
 *
 * <p>An assistant nobody reviews is an assistant nobody can trust: its failure mode is a confident
 * wrong answer, which no error rate will surface. {@code assistant_audit} already records every
 * turn, so supervision is a read, not new instrumentation.
 *
 * <p>Activation is per farm and stored as a farm setting that <b>defaults to on</b>. Switching it
 * off is a deliberate act by staff; a default of off would have silently disabled a live feature
 * for every existing farm the moment this shipped.
 */
@Service
@RequiredArgsConstructor
public class AssistantReviewService {

  private static final int MAX_TURNS = 100;

  private final AssistantAuditRepository auditRepository;
  private final AssistantAvailability availability;
  private final AdminAuditService adminAudit;

  /** One reviewed turn. The text is the point: this is a quality read, not a counter. */
  public record Turn(
      Long id,
      Long farmId,
      Long userId,
      String kind,
      String action,
      String text,
      String summary,
      LocalDateTime createdAt) {}

  @Transactional(readOnly = true)
  public List<Turn> recentTurns(Long farmId, int limit) {
    int capped = Math.min(limit <= 0 ? 20 : limit, MAX_TURNS);
    List<AssistantAudit> rows =
        farmId == null
            ? auditRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, capped))
            : auditRepository.findByFarmIdOrderByCreatedAtDesc(farmId, PageRequest.of(0, capped));
    return rows.stream().map(AssistantReviewService::toTurn).toList();
  }

  /** How many turns of each kind over the window — a shape, not a score. */
  @Transactional(readOnly = true)
  public Map<String, Long> kindBreakdown(int days) {
    Map<String, Long> counts = new LinkedHashMap<>();
    auditRepository
        .countByKindSince(LocalDateTime.now().minusDays(days))
        .forEach(row -> counts.put(row.getKind(), row.getTotal()));
    return counts;
  }

  /** Whether the assistant answers for this farm. The rule itself lives in the assistant. */
  @Transactional(readOnly = true)
  public boolean isEnabledFor(Long farmId) {
    return availability.isEnabledFor(farmId);
  }

  /** Flip the switch, and record who did — this changes what a farm can do. */
  @Transactional
  public void setEnabledFor(Long farmId, boolean enabled) {
    availability.setEnabledFor(farmId, enabled);
    adminAudit.record(
        enabled ? "assistant.enable" : "assistant.disable",
        "Farm",
        farmId,
        farmId,
        Map.of("enabled", enabled));
  }

  private static Turn toTurn(AssistantAudit a) {
    return new Turn(
        a.getId(),
        a.getFarmId(),
        a.getUserId(),
        a.getKind(),
        a.getAction(),
        a.getText(),
        a.getSummary(),
        a.getCreatedAt());
  }
}
