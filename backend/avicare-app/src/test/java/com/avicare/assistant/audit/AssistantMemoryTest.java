package com.avicare.assistant.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.avicare.assistant.llm.LlmMessage;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AssistantMemoryTest {

  @Mock private AssistantAuditRepository repository;

  private AssistantMemory memory(int turns) {
    return new AssistantMemory(repository, turns, 15);
  }

  private static AssistantAudit answer(String text, String summary) {
    AssistantAudit a = new AssistantAudit();
    a.setKind("ANSWER");
    a.setText(text);
    a.setSummary(summary);
    return a;
  }

  @Test
  void replaysRecentAnswersOldestFirstAsUserThenAssistant() {
    // Repository returns newest-first.
    when(repository.recentAnswers(eq(1L), eq(9L), any(), any()))
        .thenReturn(
            List.of(
                answer("et cette semaine ?", "12 morts cette semaine."),
                answer("quel est mon stock ?", "40 sacs.")));

    List<LlmMessage> turns = memory(3).recentTurns(1L, 9L);

    // Oldest first: stock Q/A, then week Q/A.
    assertThat(turns).hasSize(4);
    assertThat(turns.get(0).role()).isEqualTo(LlmMessage.Role.USER);
    assertThat(turns.get(0).text()).isEqualTo("quel est mon stock ?");
    assertThat(turns.get(1).role()).isEqualTo(LlmMessage.Role.ASSISTANT);
    assertThat(turns.get(1).text()).isEqualTo("40 sacs.");
    assertThat(turns.get(3).text()).isEqualTo("12 morts cette semaine.");
  }

  @Test
  void zeroTurns_disablesMemory_andNeverQueries() {
    assertThat(memory(0).recentTurns(1L, 9L)).isEmpty();
    verifyNoInteractions(repository);
  }
}
