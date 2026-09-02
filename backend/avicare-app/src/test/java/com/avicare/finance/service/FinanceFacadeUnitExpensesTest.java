package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.finance.repository.ExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** The facade relays the sum of a unit's direct expenses, STOCK_ENTRY excluded. */
class FinanceFacadeUnitExpensesTest {

  private ExpenseRepository expenseRepository;
  private FinanceFacadeImpl facade;

  @BeforeEach
  void setUp() {
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    FinanceAnalyticsService analyticsService = Mockito.mock(FinanceAnalyticsService.class);
    facade = new FinanceFacadeImpl(expenseRepository, analyticsService);
  }

  @Test
  void directExpensesForUnit_relaysTheRepositorySum() {
    when(expenseRepository.sumDirectForUnit(7L, 42L)).thenReturn(125_000L);

    assertThat(facade.directExpensesForUnit(7L, 42L)).isEqualTo(125_000L);
  }

  @Test
  void directExpensesForUnit_isZero_whenNothingAttributed() {
    when(expenseRepository.sumDirectForUnit(7L, 42L)).thenReturn(0L);

    assertThat(facade.directExpensesForUnit(7L, 42L)).isZero();
  }
}
