package com.avicare.assistant.audit;

import java.time.LocalDate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Per-user daily usage guard for the assistant — a cost guardrail checked BEFORE the LLM call, so a
 * user who hit the ceiling gets a clear message without spending another round-trip. The meter is
 * the {@code assistant_audit} trail (today's rows for the user); {@code assistant.daily-quota} ≤ 0
 * disables it.
 */
@Service
public class AssistantQuotaService {

  private final AssistantAuditRepository repository;
  private final int dailyQuota;

  public AssistantQuotaService(
      AssistantAuditRepository repository, @Value("${assistant.daily-quota:300}") int dailyQuota) {
    this.repository = repository;
    this.dailyQuota = dailyQuota;
  }

  /** The configured cap (≤ 0 means unlimited). */
  public int dailyQuota() {
    return dailyQuota;
  }

  /** True when the user has already reached today's cap and must be turned away before the LLM. */
  public boolean isExhausted(Long userId) {
    if (dailyQuota <= 0) {
      return false;
    }
    long used =
        repository.countByUserIdAndCreatedAtGreaterThanEqual(
            userId, LocalDate.now().atStartOfDay());
    return used >= dailyQuota;
  }
}
