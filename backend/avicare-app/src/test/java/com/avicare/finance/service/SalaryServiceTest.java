package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.finance.domain.AdvanceStatus;
import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.finance.domain.Salary;
import com.avicare.finance.domain.SalaryAdvance;
import com.avicare.finance.domain.SalarySetting;
import com.avicare.finance.domain.SalaryStatus;
import com.avicare.finance.dto.request.SalarySettingRequest;
import com.avicare.finance.dto.response.SalaryResponse;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.finance.repository.SalaryAdvanceRepository;
import com.avicare.finance.repository.SalaryRepository;
import com.avicare.finance.repository.SalarySettingRepository;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.UserFarmInfo;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/** Unit test for {@link SalaryService}: repositories and {@link TenancyFacade} mocked. */
class SalaryServiceTest {

  private SalarySettingRepository salarySettingRepository;
  private SalaryRepository salaryRepository;
  private SalaryAdvanceRepository salaryAdvanceRepository;
  private ExpenseRepository expenseRepository;
  private TenancyFacade tenancyFacade;
  private SalaryService salaryService;

  @BeforeEach
  void setUp() {
    salarySettingRepository = Mockito.mock(SalarySettingRepository.class);
    salaryRepository = Mockito.mock(SalaryRepository.class);
    salaryAdvanceRepository = Mockito.mock(SalaryAdvanceRepository.class);
    expenseRepository = Mockito.mock(ExpenseRepository.class);
    tenancyFacade = Mockito.mock(TenancyFacade.class);
    salaryService =
        new SalaryService(
            salarySettingRepository,
            salaryRepository,
            salaryAdvanceRepository,
            expenseRepository,
            tenancyFacade);
  }

  @Test
  void upsertSetting_nonMember_throwsNotAMember_andNeverSaves() {
    when(tenancyFacade.findMembership(5L, 3L)).thenReturn(Optional.empty());

    SalarySettingRequest request = new SalarySettingRequest(5L, 100000L, true);

    assertThatThrownBy(() -> salaryService.upsertSetting(3L, request))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "NOT_A_MEMBER");

    verify(salarySettingRepository, never()).save(any());
  }

  @Test
  void upsertSetting_inactiveMember_throwsNotAMember() {
    when(tenancyFacade.findMembership(5L, 3L))
        .thenReturn(Optional.of(new UserFarmInfo(5L, 3L, null, List.of(), false)));

    SalarySettingRequest request = new SalarySettingRequest(5L, 100000L, true);

    assertThatThrownBy(() -> salaryService.upsertSetting(3L, request))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "NOT_A_MEMBER");

    verify(salarySettingRepository, never()).save(any());
  }

  @Test
  void generate_invalidPeriod_throwsValidationException() {
    assertThatThrownBy(() -> salaryService.generate(3L, "2026-13", 9L))
        .isInstanceOf(ValidationException.class)
        .hasFieldOrPropertyWithValue("code", "INVALID_PERIOD");

    verify(salaryRepository, never()).save(any());
  }

  @Test
  void generate_alreadyGeneratedForPeriod_throwsConflict_andCreatesNothing() {
    SalarySetting setting = activeSetting(5L, 120000L);
    when(salarySettingRepository.findByFarmIdAndActiveTrueOrderByUserId(3L))
        .thenReturn(List.of(setting));
    when(salaryRepository.existsByFarmIdAndUserIdAndPeriod(3L, 5L, "2026-07")).thenReturn(true);

    assertThatThrownBy(() -> salaryService.generate(3L, "2026-07", 9L))
        .isInstanceOf(ConflictException.class)
        .hasFieldOrPropertyWithValue("code", "SALARY_PERIOD_EXISTS");

    verify(salaryRepository, never()).save(any());
  }

  @Test
  void generate_multipleAdvances_fullyConsumedOldestFirst() {
    SalarySetting setting = activeSetting(5L, 120000L);
    when(salarySettingRepository.findByFarmIdAndActiveTrueOrderByUserId(3L))
        .thenReturn(List.of(setting));
    when(salaryRepository.existsByFarmIdAndUserIdAndPeriod(3L, 5L, "2026-07")).thenReturn(false);

    SalaryAdvance oldAdvance = approvedAdvance(1L, 30000L);
    SalaryAdvance newAdvance = approvedAdvance(2L, 50000L);
    when(salaryAdvanceRepository
            .findByFarmIdAndUserIdAndStatusAndRemainingXofGreaterThanOrderByDecidedAtAscIdAsc(
                3L, 5L, AdvanceStatus.APPROVED, 0L))
        .thenReturn(List.of(oldAdvance, newAdvance));
    when(salaryRepository.save(any(Salary.class)))
        .thenAnswer(
            inv -> {
              Salary s = inv.getArgument(0);
              s.setId(42L);
              return s;
            });

    List<SalaryResponse> created = salaryService.generate(3L, "2026-07", 9L);

    assertThat(created).hasSize(1);
    SalaryResponse response = created.get(0);
    assertThat(response.grossXof()).isEqualTo(120000L);
    assertThat(response.advanceDeductedXof()).isEqualTo(80000L);
    assertThat(response.netXof()).isEqualTo(40000L);
    assertThat(response.status()).isEqualTo("DUE");
    assertThat(oldAdvance.getRemainingXof()).isZero();
    assertThat(newAdvance.getRemainingXof()).isZero();

    ArgumentCaptor<Salary> captor = ArgumentCaptor.forClass(Salary.class);
    verify(salaryRepository).save(captor.capture());
    Salary saved = captor.getValue();
    assertThat(saved.getCreatedBy()).isEqualTo(9L);
    assertThat(saved.getUserId()).isEqualTo(5L);
    assertThat(saved.getFarmId()).isEqualTo(3L);
  }

  @Test
  void generate_partialDeductionCarriesOverRemainingBalance() {
    SalarySetting setting = activeSetting(5L, 50000L);
    when(salarySettingRepository.findByFarmIdAndActiveTrueOrderByUserId(3L))
        .thenReturn(List.of(setting));
    when(salaryRepository.existsByFarmIdAndUserIdAndPeriod(3L, 5L, "2026-07")).thenReturn(false);

    SalaryAdvance oldAdvance = approvedAdvance(1L, 30000L);
    SalaryAdvance newAdvance = approvedAdvance(2L, 40000L);
    when(salaryAdvanceRepository
            .findByFarmIdAndUserIdAndStatusAndRemainingXofGreaterThanOrderByDecidedAtAscIdAsc(
                3L, 5L, AdvanceStatus.APPROVED, 0L))
        .thenReturn(List.of(oldAdvance, newAdvance));
    when(salaryRepository.save(any(Salary.class))).thenAnswer(inv -> inv.getArgument(0));

    List<SalaryResponse> created = salaryService.generate(3L, "2026-07", 9L);

    SalaryResponse response = created.get(0);
    assertThat(response.advanceDeductedXof()).isEqualTo(50000L);
    assertThat(response.netXof()).isZero();
    assertThat(oldAdvance.getRemainingXof()).isZero();
    assertThat(newAdvance.getRemainingXof()).isEqualTo(20000L);
  }

  @Test
  void generate_memberWithoutActiveSetting_absentFromGeneration() {
    when(salarySettingRepository.findByFarmIdAndActiveTrueOrderByUserId(3L)).thenReturn(List.of());

    List<SalaryResponse> created = salaryService.generate(3L, "2026-07", 9L);

    assertThat(created).isEmpty();
    verify(salaryRepository, never()).save(any());
  }

  @Test
  void pay_alreadyPaid_throwsBusinessRule() {
    Salary salary = dueSalary(11L, 3L, 5L, 40000L);
    salary.setStatus(SalaryStatus.PAID);
    when(salaryRepository.findById(11L)).thenReturn(Optional.of(salary));

    assertThatThrownBy(() -> salaryService.pay(3L, 11L, 9L))
        .isInstanceOf(BusinessRuleException.class)
        .hasFieldOrPropertyWithValue("code", "SALARY_ALREADY_PAID");

    verify(expenseRepository, never()).save(any());
  }

  @Test
  void pay_netPositive_marksPaidAndCreatesSalaryExpense() {
    Salary salary = dueSalary(11L, 3L, 5L, 40000L);
    when(salaryRepository.findById(11L)).thenReturn(Optional.of(salary));
    when(salaryRepository.save(any(Salary.class))).thenAnswer(inv -> inv.getArgument(0));

    salaryService.pay(3L, 11L, 9L);

    assertThat(salary.getStatus()).isEqualTo(SalaryStatus.PAID);
    assertThat(salary.getPaidAt()).isNotNull();

    ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
    verify(expenseRepository).save(captor.capture());
    Expense expense = captor.getValue();
    assertThat(expense.getSource()).isEqualTo(ExpenseSource.SALARY);
    assertThat(expense.getCategoryKey()).isEqualTo("staff");
    assertThat(expense.getAmountXof()).isEqualTo(40000L);
    assertThat(expense.getSalaryId()).isEqualTo(11L);
    assertThat(expense.getCreatedBy()).isEqualTo(9L);
  }

  @Test
  void pay_netZero_createsNoExpense() {
    Salary salary = dueSalary(11L, 3L, 5L, 0L);
    when(salaryRepository.findById(11L)).thenReturn(Optional.of(salary));
    when(salaryRepository.save(any(Salary.class))).thenAnswer(inv -> inv.getArgument(0));

    salaryService.pay(3L, 11L, 9L);

    assertThat(salary.getStatus()).isEqualTo(SalaryStatus.PAID);
    verify(expenseRepository, never()).save(any());
  }

  private static SalarySetting activeSetting(Long userId, Long monthlySalaryXof) {
    SalarySetting setting = new SalarySetting();
    setting.setUserId(userId);
    setting.setMonthlySalaryXof(monthlySalaryXof);
    setting.setActive(true);
    return setting;
  }

  private static SalaryAdvance approvedAdvance(Long id, Long remaining) {
    SalaryAdvance advance = new SalaryAdvance();
    advance.setId(id);
    advance.setStatus(AdvanceStatus.APPROVED);
    advance.setRemainingXof(remaining);
    advance.setDecidedAt(LocalDateTime.now());
    return advance;
  }

  private static Salary dueSalary(Long id, Long farmId, Long userId, Long netXof) {
    Salary salary = new Salary();
    salary.setId(id);
    salary.setFarmId(farmId);
    salary.setUserId(userId);
    salary.setPeriod("2026-07");
    salary.setGrossXof(100000L);
    salary.setAdvanceDeductedXof(100000L - netXof);
    salary.setNetXof(netXof);
    salary.setStatus(SalaryStatus.DUE);
    return salary;
  }
}
