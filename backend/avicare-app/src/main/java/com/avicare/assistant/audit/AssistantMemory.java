package com.avicare.assistant.audit;

import com.avicare.assistant.llm.LlmMessage;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * Short-term conversational memory: the user's last few ANSWER interactions on the farm, replayed
 * as prior turns so a read follow-up ("et la semaine dernière ?") keeps its subject. Only read
 * answers are replayed — never write drafts, so the model is never nudged to re-propose an action.
 * Bounded by {@code assistant.memory-turns} (0 disables it) and a short time window.
 */
@Service
public class AssistantMemory {

  private final AssistantAuditRepository repository;
  private final int turns;
  private final int windowMinutes;

  public AssistantMemory(
      AssistantAuditRepository repository,
      @Value("${assistant.memory-turns:3}") int turns,
      @Value("${assistant.memory-window-minutes:15}") int windowMinutes) {
    this.repository = repository;
    this.turns = turns;
    this.windowMinutes = windowMinutes;
  }

  /** Prior turns (chronological) to prepend to the loop history; empty when disabled or none. */
  public List<LlmMessage> recentTurns(Long farmId, Long userId) {
    if (turns <= 0) {
      return List.of();
    }
    LocalDateTime since = LocalDateTime.now().minusMinutes(windowMinutes);
    List<AssistantAudit> recent =
        repository.recentAnswers(farmId, userId, since, PageRequest.of(0, turns));

    List<LlmMessage> history = new ArrayList<>();
    // Rows come newest-first; replay oldest-first so the conversation reads in order.
    for (int i = recent.size() - 1; i >= 0; i--) {
      AssistantAudit row = recent.get(i);
      history.add(LlmMessage.user(row.getText()));
      history.add(
          LlmMessage.assistant(row.getSummary() == null ? "" : row.getSummary(), List.of()));
    }
    return history;
  }
}
