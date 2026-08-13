package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.finance.api.FinanceFacade;
import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.finance.dto.request.ExpenseRequest;
import com.avicare.finance.dto.response.ExpenseResponse;
import com.avicare.finance.repository.ExpenseRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/** Unit test for {@link ExpenseService} and {@link FinanceFacadeImpl}: repository mocked. */
class ExpenseServiceTest {

  private ExpenseRepository expenseRepository;
  private ExpenseService expenseService;
  private FinanceFacade financeFacade;

  @BeforeEach
  void setUp() {
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    expenseService = new ExpenseService(expenseRepository);
    financeFacade =
        new FinanceFacadeImpl(expenseRepository, Mockito.mock(FinanceAnalyticsService.class));
  }

  @Test
  void create_persistsManualExpenseWithRequestFields() {
    when(expenseRepository.save(any(Expense.class)))
        .thenAnswer(
            inv -> {
              Expense e = inv.getArgument(0);
              e.setId(1L);
              return e;
            });

    ExpenseRequest request =
        new ExpenseRequest("feed", 15000L, LocalDate.of(2026, 7, 1), "Achat aliment", "note", 4L);

    ExpenseResponse response = expenseService.create(3L, request, 9L);

    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository).save(captor.capture());
    Expense saved = captor.getValue();
    assertThat(saved.getFarmId()).isEqualTo(3L);
    assertThat(saved.getSource()).isEqualTo(ExpenseSource.MANUAL);
    assertThat(saved.getCategoryKey()).isEqualTo("feed");
    assertThat(saved.getAmountXof()).isEqualTo(15000L);
    assertThat(saved.getLabel()).isEqualTo("Achat aliment");
    assertThat(saved.getNotes()).isEqualTo("note");
    assertThat(saved.getProductionUnitId()).isEqualTo(4L);
    assertThat(saved.getCreatedBy()).isEqualTo(9L);
    assertThat(response.categoryKey()).isEqualTo("feed");
    assertThat(response.source()).isEqualTo("MANUAL");
  }

  @Test
  void update_purchaseSourcedExpense_throwsBusinessRule_andNeverSaves() {
    Expense existing = new Expense();
    existing.setId(10L);
    existing.setFarmId(3L);
    existing.setSource(ExpenseSource.PURCHASE);
    when(expenseRepository.findById(10L)).thenReturn(Optional.of(existing));

    ExpenseRequest request = new ExpenseRequest("feed", 1000L, LocalDate.now(), "x", null, null);

    assertThatThrownBy(() -> expenseService.update(3L, 10L, request))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "EXPENSE_NOT_EDITABLE");

    verify(expenseRepository, never()).save(any());
  }

  @Test
  void delete_stockEntrySourcedExpense_throwsBusinessRule() {
    Expense existing = new Expense();
    existing.setId(11L);
    existing.setFarmId(3L);
    existing.setSource(ExpenseSource.STOCK_ENTRY);
    when(expenseRepository.findById(11L)).thenReturn(Optional.of(existing));

    assertThatThrownBy(() -> expenseService.delete(3L, 11L))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "EXPENSE_NOT_EDITABLE");

    verify(expenseRepository, never()).delete(any());
  }

  @Test
  void update_manualExpenseOnOtherFarm_throwsNotFound() {
    Expense existing = new Expense();
    existing.setId(12L);
    existing.setFarmId(99L);
    existing.setSource(ExpenseSource.MANUAL);
    when(expenseRepository.findById(12L)).thenReturn(Optional.of(existing));

    ExpenseRequest request = new ExpenseRequest("feed", 1000L, LocalDate.now(), "x", null, null);

    assertThatThrownBy(() -> expenseService.update(3L, 12L, request))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void delete_manualExpenseOnOtherFarm_throwsNotFound() {
    Expense existing = new Expense();
    existing.setId(13L);
    existing.setFarmId(99L);
    existing.setSource(ExpenseSource.MANUAL);
    when(expenseRepository.findById(13L)).thenReturn(Optional.of(existing));

    assertThatThrownBy(() -> expenseService.delete(3L, 13L)).isInstanceOf(NotFoundException.class);
  }

  @Test
  void recordPurchaseExpenses_groupsLinesByCategory_twoSaves() {
    when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));

    financeFacade.recordPurchaseExpenses(
        3L,
        77L,
        "PO-001",
        LocalDate.of(2026, 7, 1),
        List.of(
            new FinanceFacade.PurchaseExpenseLine("INVENTORY", "FEED", 30000),
            new FinanceFacade.PurchaseExpenseLine("INVENTORY", "FEED", 20000),
            new FinanceFacade.PurchaseExpenseLine("TREATMENT", null, 5000)),
        9L);

    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository, times(2)).save(captor.capture());
    List<Expense> saved = captor.getAllValues();

    Expense feed =
        saved.stream().filter(e -> e.getCategoryKey().equals("feed")).findFirst().orElseThrow();
    assertThat(feed.getAmountXof()).isEqualTo(50000L);
    assertThat(feed.getSource()).isEqualTo(ExpenseSource.PURCHASE);
    assertThat(feed.getPurchaseOrderId()).isEqualTo(77L);
    assertThat(feed.getFarmId()).isEqualTo(3L);
    assertThat(feed.getLabel()).isEqualTo("Achat PO-001");
    assertThat(feed.getCreatedBy()).isEqualTo(9L);

    Expense vet =
        saved.stream()
            .filter(e -> e.getCategoryKey().equals("veterinary"))
            .findFirst()
            .orElseThrow();
    assertThat(vet.getAmountXof()).isEqualTo(5000L);
    assertThat(vet.getSource()).isEqualTo(ExpenseSource.PURCHASE);
  }

  @Test
  void recordStockEntryExpense_zeroValue_noOp() {
    financeFacade.recordStockEntryExpense(
        3L, 55L, "INVENTORY", "FEED", "Mais", 0L, LocalDate.now(), null, 9L);

    verify(expenseRepository, never()).save(any());
  }

  @Test
  void recordStockEntryExpense_positiveValue_savesStockEntryExpense() {
    when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));

    financeFacade.recordStockEntryExpense(
        3L, 55L, "INVENTORY", "FEED", "Mais", 25000L, LocalDate.of(2026, 7, 2), 6L, 9L);

    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository).save(captor.capture());
    Expense saved = captor.getValue();
    assertThat(saved.getSource()).isEqualTo(ExpenseSource.STOCK_ENTRY);
    assertThat(saved.getCategoryKey()).isEqualTo("feed");
    assertThat(saved.getLabel()).isEqualTo("Entrée stock — Mais");
    assertThat(saved.getStockMovementId()).isEqualTo(55L);
    assertThat(saved.getProductionUnitId()).isEqualTo(6L);
    assertThat(saved.getAmountXof()).isEqualTo(25000L);
    assertThat(saved.getCreatedBy()).isEqualTo(9L);
  }
}
