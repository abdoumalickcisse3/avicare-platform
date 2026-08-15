package com.avicare.assistant.confirm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.assistant.audit.AssistantAuditService;
import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PendingActionServiceTest {

  @Mock private PendingActionRepository repository;
  @Mock private DraftExecutorRegistry executors;
  @Mock private AssistantAuditService audit;
  @Mock private DraftExecutor executor;

  private PendingActionService service() {
    return new PendingActionService(repository, executors, audit, 5);
  }

  private static PendingAction claim(String action, LocalDateTime expiresAt) {
    PendingAction p = new PendingAction();
    p.setClaimId("c-1");
    p.setFarmId(1L);
    p.setUserId(9L);
    p.setAction(action);
    p.setFields(Map.of("invoiceId", 42, "amountXof", 30000));
    p.setExpiresAt(expiresAt);
    return p;
  }

  @Test
  void claim_storesADraftWithAFutureExpiry() {
    when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    String id =
        service()
            .claim(
                1L, 9L, InterpretResponse.draft("RECORD_PAYMENT", null, Map.of(), "Encaissement"));

    assertThat(id).isNotBlank();
  }

  @Test
  void confirm_executesTheActionAndDeletesTheClaim() {
    when(repository.findByClaimId("c-1"))
        .thenReturn(Optional.of(claim("RECORD_PAYMENT", LocalDateTime.now().plusMinutes(5))));
    when(executors.find("RECORD_PAYMENT")).thenReturn(Optional.of(executor));

    PendingActionService.ConfirmResult result = service().confirm(1L, 9L, "c-1");

    assertThat(result.action()).isEqualTo("RECORD_PAYMENT");
    verify(executor).execute(eq(1L), eq(9L), any());
    verify(repository).delete(any());
  }

  @Test
  void confirm_expiredClaim_isDeletedAndRefused() {
    when(repository.findByClaimId("c-1"))
        .thenReturn(Optional.of(claim("RECORD_PAYMENT", LocalDateTime.now().minusMinutes(1))));

    assertThatThrownBy(() -> service().confirm(1L, 9L, "c-1"))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "ASSISTANT_CLAIM_EXPIRED");

    verify(repository).delete(any());
    verify(executor, never()).execute(any(), any(), any());
  }

  @Test
  void confirm_foreignClaim_isNotFound() {
    when(repository.findByClaimId("c-1"))
        .thenReturn(Optional.of(claim("RECORD_PAYMENT", LocalDateTime.now().plusMinutes(5))));

    // Different user → treated as not found (never leaks another user's claim).
    assertThatThrownBy(() -> service().confirm(1L, 999L, "c-1"))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void confirm_unsupportedAction_isRefused() {
    when(repository.findByClaimId("c-1"))
        .thenReturn(Optional.of(claim("CREATE_CLIENT", LocalDateTime.now().plusMinutes(5))));
    when(executors.find("CREATE_CLIENT")).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().confirm(1L, 9L, "c-1"))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "ASSISTANT_ACTION_UNSUPPORTED");

    verify(repository, never()).delete(any());
  }
}
