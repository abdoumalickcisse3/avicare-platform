package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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

/** Upsert semantics for the chick-purchase expense: one row per unit, created then corrected. */
class FinanceFacadeChickPurchaseTest {

  private ExpenseRepository expenseRepository;
  private FinanceFacadeImpl facade;

  @BeforeEach
  void setUp() {
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    FinanceAnalyticsService analyticsService = Mockito.mock(FinanceAnalyticsService.class);
    facade = new FinanceFacadeImpl(expenseRepository, analyticsService);
  }

  @Test
  void recordChickPurchaseExpense_insertsANewExpense_whenNoneExistsYet() {
    when(expenseRepository.findByFarmIdAndProductionUnitIdAndSource(
            7L, 42L, ExpenseSource.CHICK_PURCHASE))
        .thenReturn(Optional.empty());

    facade.recordChickPurchaseExpense(7L, 42L, 500_000L, LocalDate.of(2026, 1, 10), 3L);

    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository).save(captor.capture());
    Expense saved = captor.getValue();
    assertThat(saved.getFarmId()).isEqualTo(7L);
    assertThat(saved.getProductionUnitId()).isEqualTo(42L);
    assertThat(saved.getCategoryKey()).isEqualTo("chicks");
    assertThat(saved.getAmountXof()).isEqualTo(500_000L);
    assertThat(saved.getExpenseDate()).isEqualTo(LocalDate.of(2026, 1, 10));
    assertThat(saved.getSource()).isEqualTo(ExpenseSource.CHICK_PURCHASE);
    assertThat(saved.getCreatedBy()).isEqualTo(3L);
  }

  @Test
  void recordChickPurchaseExpense_updatesTheExistingExpense_ratherThanDuplicating() {
    Expense existing = new Expense();
    existing.setId(99L);
    existing.setFarmId(7L);
    existing.setProductionUnitId(42L);
    existing.setSource(ExpenseSource.CHICK_PURCHASE);
    existing.setAmountXof(400_000L);
    when(expenseRepository.findByFarmIdAndProductionUnitIdAndSource(
            7L, 42L, ExpenseSource.CHICK_PURCHASE))
        .thenReturn(Optional.of(existing));

    facade.recordChickPurchaseExpense(7L, 42L, 550_000L, LocalDate.of(2026, 1, 10), 3L);

    verify(expenseRepository, times(1)).save(any(Expense.class));
    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository).save(captor.capture());
    assertThat(captor.getValue().getId()).isEqualTo(99L); // same row, not a new one
    assertThat(captor.getValue().getAmountXof()).isEqualTo(550_000L);
  }

  @Test
  void recordChickPurchaseExpense_doesNothing_whenAmountIsNotPositive() {
    facade.recordChickPurchaseExpense(7L, 42L, 0L, LocalDate.now(), 3L);

    verify(expenseRepository, never()).save(any());
  }

  @Test
  void chickPurchaseCostForUnit_returnsTheAmount_whenAnExpenseExists() {
    Expense existing = new Expense();
    existing.setAmountXof(500_000L);
    when(expenseRepository.findByFarmIdAndProductionUnitIdAndSource(
            7L, 42L, ExpenseSource.CHICK_PURCHASE))
        .thenReturn(Optional.of(existing));

    assertThat(facade.chickPurchaseCostForUnit(7L, 42L)).contains(500_000L);
  }

  @Test
  void chickPurchaseCostForUnit_isEmpty_whenNoneRecorded() {
    when(expenseRepository.findByFarmIdAndProductionUnitIdAndSource(
            7L, 42L, ExpenseSource.CHICK_PURCHASE))
        .thenReturn(Optional.empty());

    assertThat(facade.chickPurchaseCostForUnit(7L, 42L)).isEmpty();
  }
}
