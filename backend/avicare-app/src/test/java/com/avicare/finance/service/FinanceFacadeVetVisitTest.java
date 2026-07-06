package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.finance.repository.ExpenseRepository;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/** Unit test for the vet-visit auto-expense hooks on {@link FinanceFacadeImpl}. */
class FinanceFacadeVetVisitTest {

  private ExpenseRepository expenseRepository;
  private FinanceFacadeImpl facade;

  @BeforeEach
  void setUp() {
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    facade = new FinanceFacadeImpl(expenseRepository);
  }

  @Test
  void recordVetVisitExpense_createsVeterinaryExpense() {
    when(expenseRepository.findByFarmIdAndVetVisitId(3L, 77L)).thenReturn(Optional.empty());

    facade.recordVetVisitExpense(
        3L, 77L, "Visite vétérinaire — Vaccination", 15000L, LocalDate.of(2026, 7, 6), 42L, 9L);

    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository).save(captor.capture());
    Expense e = captor.getValue();
    assertThat(e.getFarmId()).isEqualTo(3L);
    assertThat(e.getCategoryKey()).isEqualTo("veterinary");
    assertThat(e.getSource()).isEqualTo(ExpenseSource.VET_VISIT);
    assertThat(e.getVetVisitId()).isEqualTo(77L);
    assertThat(e.getAmountXof()).isEqualTo(15000L);
    assertThat(e.getProductionUnitId()).isEqualTo(42L);
    assertThat(e.getCreatedBy()).isEqualTo(9L);
    assertThat(e.getLabel()).isEqualTo("Visite vétérinaire — Vaccination");
  }

  @Test
  void recordVetVisitExpense_idempotent_skipsWhenAlreadyLinked() {
    when(expenseRepository.findByFarmIdAndVetVisitId(3L, 77L))
        .thenReturn(Optional.of(new Expense()));

    facade.recordVetVisitExpense(3L, 77L, "x", 15000L, LocalDate.now(), 42L, 9L);

    verify(expenseRepository, never()).save(any());
  }

  @Test
  void recordVetVisitExpense_nonPositiveAmount_noOp() {
    facade.recordVetVisitExpense(3L, 77L, "x", 0L, LocalDate.now(), 42L, 9L);
    verify(expenseRepository, never()).save(any());
  }

  @Test
  void reverseVetVisitExpense_softDeletesLinkedExpense() {
    Expense e = new Expense();
    when(expenseRepository.findByFarmIdAndVetVisitId(3L, 77L)).thenReturn(Optional.of(e));

    facade.reverseVetVisitExpense(3L, 77L);

    verify(expenseRepository).delete(e);
  }

  @Test
  void reverseVetVisitExpense_noOpWhenAbsent() {
    when(expenseRepository.findByFarmIdAndVetVisitId(3L, 77L)).thenReturn(Optional.empty());

    facade.reverseVetVisitExpense(3L, 77L);

    verify(expenseRepository, never()).delete(any());
  }
}
