package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.finance.domain.AdvanceStatus;
import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.finance.domain.SalaryAdvance;
import com.avicare.finance.dto.response.AdvanceResponse;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.finance.repository.SalaryAdvanceRepository;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.UserFarmInfo;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/** Unit test for {@link AdvanceService}: repositories and {@link TenancyFacade} mocked. */
class AdvanceServiceTest {

  private SalaryAdvanceRepository salaryAdvanceRepository;
  private ExpenseRepository expenseRepository;
  private TenancyFacade tenancyFacade;
  private AdvanceService advanceService;

  @BeforeEach
  void setUp() {
    salaryAdvanceRepository = Mockito.mock(SalaryAdvanceRepository.class);
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    tenancyFacade = Mockito.mock(TenancyFacade.class);
    advanceService = new AdvanceService(salaryAdvanceRepository, expenseRepository, tenancyFacade);
  }

  @Test
  void requestSelf_nonMember_throwsNotAMember_andNeverSaves() {
    when(tenancyFacade.findMembership(5L, 3L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> advanceService.requestSelf(3L, 5L, 20000L, "Urgence"))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "NOT_A_MEMBER");

    verify(salaryAdvanceRepository, never()).save(any());
  }

  @Test
  void requestSelf_activeMember_createsPendingAdvanceWithZeroRemaining() {
    when(tenancyFacade.findMembership(5L, 3L))
        .thenReturn(Optional.of(new UserFarmInfo(5L, 3L, null, List.of(), true)));
    when(salaryAdvanceRepository.save(any(SalaryAdvance.class)))
        .thenAnswer(
            inv -> {
              SalaryAdvance a = inv.getArgument(0);
              a.setId(1L);
              return a;
            });

    AdvanceResponse response = advanceService.requestSelf(3L, 5L, 20000L, "Urgence");

    ArgumentCaptor<SalaryAdvance> captor = ArgumentCaptor.forClass(SalaryAdvance.class);
    verify(salaryAdvanceRepository).save(captor.capture());
    SalaryAdvance saved = captor.getValue();
    assertThat(saved.getStatus()).isEqualTo(AdvanceStatus.PENDING);
    assertThat(saved.getRemainingXof()).isZero();
    assertThat(saved.getAmountXof()).isEqualTo(20000L);
    assertThat(response.status()).isEqualTo("PENDING");
  }

  @Test
  void approve_nonPending_throwsAdvanceNotPending() {
    SalaryAdvance advance = advanceOf(1L, 3L, 5L, 20000L, AdvanceStatus.APPROVED);
    when(salaryAdvanceRepository.findById(1L)).thenReturn(Optional.of(advance));

    assertThatThrownBy(() -> advanceService.approve(3L, 1L, 7L))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "ADVANCE_NOT_PENDING");

    verify(expenseRepository, never()).save(any());
  }

  @Test
  void approve_pending_setsRemainingToAmount_andCreatesPayoutExpense() {
    SalaryAdvance advance = advanceOf(1L, 3L, 5L, 20000L, AdvanceStatus.PENDING);
    when(salaryAdvanceRepository.findById(1L)).thenReturn(Optional.of(advance));
    when(salaryAdvanceRepository.save(any(SalaryAdvance.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    AdvanceResponse response = advanceService.approve(3L, 1L, 7L);

    assertThat(advance.getStatus()).isEqualTo(AdvanceStatus.APPROVED);
    assertThat(advance.getDecidedBy()).isEqualTo(7L);
    assertThat(advance.getDecidedAt()).isNotNull();
    assertThat(response.remainingXof()).isEqualTo(20000L);

    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository).save(captor.capture());
    Expense expense = captor.getValue();
    assertThat(expense.getSource()).isEqualTo(ExpenseSource.SALARY);
    assertThat(expense.getCategoryKey()).isEqualTo("staff");
    assertThat(expense.getAmountXof()).isEqualTo(20000L);
    assertThat(expense.getLabel()).isEqualTo("Avance sur salaire");
    assertThat(expense.getSalaryId()).isNull();
    assertThat(expense.getCreatedBy()).isEqualTo(7L);
  }

  @Test
  void reject_pending_setsRejected_andCreatesNoExpense() {
    SalaryAdvance advance = advanceOf(1L, 3L, 5L, 20000L, AdvanceStatus.PENDING);
    when(salaryAdvanceRepository.findById(1L)).thenReturn(Optional.of(advance));
    when(salaryAdvanceRepository.save(any(SalaryAdvance.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    advanceService.reject(3L, 1L, 7L);

    assertThat(advance.getStatus()).isEqualTo(AdvanceStatus.REJECTED);
    assertThat(advance.getDecidedBy()).isEqualTo(7L);
    verify(expenseRepository, never()).save(any());
  }

  @Test
  void reject_nonPending_throwsAdvanceNotPending() {
    SalaryAdvance advance = advanceOf(1L, 3L, 5L, 20000L, AdvanceStatus.REJECTED);
    when(salaryAdvanceRepository.findById(1L)).thenReturn(Optional.of(advance));

    assertThatThrownBy(() -> advanceService.reject(3L, 1L, 7L))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "ADVANCE_NOT_PENDING");
  }

  private static SalaryAdvance advanceOf(
      Long id, Long farmId, Long userId, Long amountXof, AdvanceStatus status) {
    SalaryAdvance advance = new SalaryAdvance();
    advance.setId(id);
    advance.setFarmId(farmId);
    advance.setUserId(userId);
    advance.setAmountXof(amountXof);
    advance.setStatus(status);
    advance.setRemainingXof(0L);
    return advance;
  }
}
