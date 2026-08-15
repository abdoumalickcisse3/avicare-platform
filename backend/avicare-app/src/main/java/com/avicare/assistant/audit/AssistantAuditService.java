package com.avicare.assistant.audit;

import com.avicare.assistant.dto.InterpretResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Records every assistant interaction, best-effort. Auditing must never break the interpret call:
 * any persistence failure is swallowed and logged, so a field worker's request still returns. The
 * save runs in the repository's own transaction (the interpret path itself is read-only).
 */
@Service
@RequiredArgsConstructor
public class AssistantAuditService {

  private static final Logger log = LoggerFactory.getLogger(AssistantAuditService.class);
  private static final int MAX_TEXT = 2000;

  private final AssistantAuditRepository repository;

  /** Persist the interaction; never throws. */
  public void record(Long farmId, Long userId, String text, InterpretResponse response) {
    try {
      AssistantAudit row = new AssistantAudit();
      row.setFarmId(farmId);
      row.setUserId(userId);
      row.setText(truncate(text));
      row.setKind(response.kind());
      row.setAction(response.action());
      row.setSummary(truncate(outcome(response)));
      repository.save(row);
    } catch (RuntimeException e) {
      log.warn("Assistant audit skipped ({})", e.toString());
    }
  }

  /** Trace a server-confirm outcome (kind CONFIRMED or EXPIRED); never throws. */
  public void recordAction(Long farmId, Long userId, String action, String kind, String summary) {
    try {
      AssistantAudit row = new AssistantAudit();
      row.setFarmId(farmId);
      row.setUserId(userId);
      row.setText(action);
      row.setKind(kind);
      row.setAction(action);
      row.setSummary(truncate(summary));
      repository.save(row);
    } catch (RuntimeException e) {
      log.warn("Assistant action audit skipped ({})", e.toString());
    }
  }

  /** The human-readable outcome: the answer/clarification message, else the draft summary. */
  private static String outcome(InterpretResponse response) {
    return response.message() != null ? response.message() : response.summary();
  }

  private static String truncate(String s) {
    if (s == null) {
      return null;
    }
    return s.length() <= MAX_TEXT ? s : s.substring(0, MAX_TEXT);
  }
}
