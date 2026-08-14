package com.avicare.assistant.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AssistantAuditServiceTest {

  @Mock private AssistantAuditRepository repository;

  private AssistantAuditService service() {
    return new AssistantAuditService(repository);
  }

  @Test
  void recordsADraftWithItsActionAndSummary() {
    InterpretResponse draft =
        InterpretResponse.draft("MORTALITY", 3L, Map.of("count", 10), "Mortalité de 10 sujets.");

    service().record(1L, 9L, "dix sont morts", draft);

    ArgumentCaptor<AssistantAudit> captor = ArgumentCaptor.forClass(AssistantAudit.class);
    Mockito.verify(repository).save(captor.capture());
    AssistantAudit saved = captor.getValue();
    assertThat(saved.getFarmId()).isEqualTo(1L);
    assertThat(saved.getUserId()).isEqualTo(9L);
    assertThat(saved.getText()).isEqualTo("dix sont morts");
    assertThat(saved.getKind()).isEqualTo("DRAFT");
    assertThat(saved.getAction()).isEqualTo("MORTALITY");
    assertThat(saved.getSummary()).isEqualTo("Mortalité de 10 sujets.");
  }

  @Test
  void recordsAnAnswerWithItsMessageAsSummary() {
    InterpretResponse answer = InterpretResponse.answer("Il reste 40 sacs.");

    service().record(1L, 9L, "quel stock ?", answer);

    ArgumentCaptor<AssistantAudit> captor = ArgumentCaptor.forClass(AssistantAudit.class);
    Mockito.verify(repository).save(captor.capture());
    AssistantAudit saved = captor.getValue();
    assertThat(saved.getKind()).isEqualTo("ANSWER");
    assertThat(saved.getAction()).isNull();
    assertThat(saved.getSummary()).isEqualTo("Il reste 40 sacs.");
  }

  @Test
  void auditFailureNeverBreaksTheCall() {
    when(repository.save(Mockito.any())).thenThrow(new RuntimeException("db down"));

    assertThatCode(() -> service().record(1L, 9L, "dix sont morts", InterpretResponse.answer("x")))
        .doesNotThrowAnyException();
  }
}
