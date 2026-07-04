package com.avicare.finance.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
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
import com.avicare.finance.dto.response.SalarySettingResponse;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.finance.repository.SalaryAdvanceRepository;
import com.avicare.finance.repository.SalaryRepository;
import com.avicare.finance.repository.SalarySettingRepository;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.UserFarmInfo;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Monthly salary settings, idempotent generation with advance deduction, and payment-to-expense for
 * farm members (Sprint B6 P2, design spec §5).
 */
@Service
@RequiredArgsConstructor
public class SalaryService {

  private static final Pattern PERIOD_PATTERN = Pattern.compile("^\\d{4}-(0[1-9]|1[0-2])$");

  private final SalarySettingRepository salarySettingRepository;
  private final SalaryRepository salaryRepository;
  private final SalaryAdvanceRepository salaryAdvanceRepository;
  private final ExpenseRepository expenseRepository;
  private final TenancyFacade tenancyFacade;

  @Transactional
  public SalarySettingResponse upsertSetting(Long farmId, SalarySettingRequest request) {
    requireActiveMember(farmId, request.userId());
    SalarySetting setting =
        salarySettingRepository
            .findByFarmIdAndUserId(farmId, request.userId())
            .orElseGet(SalarySetting::new);
    setting.setFarmId(farmId);
    setting.setUserId(request.userId());
    setting.setMonthlySalaryXof(request.monthlySalaryXof());
    if (request.active() != null) {
      setting.setActive(request.active());
    } else if (setting.getActive() == null) {
      setting.setActive(true);
    }
    return toSettingResponse(salarySettingRepository.save(setting));
  }

  @Transactional(readOnly = true)
  public List<SalarySettingResponse> listSettings(Long farmId) {
    return salarySettingRepository.findByFarmIdOrderByUserId(farmId).stream()
        .map(SalaryService::toSettingResponse)
        .toList();
  }

  /**
   * Generates salaries for the given period for every active salary setting of the farm. Idempotent
   * per (farm, user, period): if ANY active setting already has a salary for this period, the whole
   * call is refused before anything is created (two-pass check).
   */
  @Transactional
  public List<SalaryResponse> generate(Long farmId, String period, Long userId) {
    if (period == null || !PERIOD_PATTERN.matcher(period).matches()) {
      throw new ValidationException(
          "INVALID_PERIOD", "Period must be in format YYYY-MM, got: " + period);
    }

    List<SalarySetting> activeSettings =
        salarySettingRepository.findByFarmIdAndActiveTrueOrderByUserId(farmId);

    for (SalarySetting setting : activeSettings) {
      if (salaryRepository.existsByFarmIdAndUserIdAndPeriod(farmId, setting.getUserId(), period)) {
        throw new ConflictException(
            "SALARY_PERIOD_EXISTS",
            "Salary already generated for user " + setting.getUserId() + " for period " + period);
      }
    }

    List<Salary> created = new ArrayList<>();
    for (SalarySetting setting : activeSettings) {
      created.add(generateForSetting(farmId, period, userId, setting));
    }
    return created.stream().map(SalaryService::toResponse).toList();
  }

  private Salary generateForSetting(
      Long farmId, String period, Long userId, SalarySetting setting) {
    long gross = setting.getMonthlySalaryXof();
    List<SalaryAdvance> advances =
        salaryAdvanceRepository
            .findByFarmIdAndUserIdAndStatusAndRemainingXofGreaterThanOrderByDecidedAtAscIdAsc(
                farmId, setting.getUserId(), AdvanceStatus.APPROVED, 0L);

    long remainingGross = gross;
    long deducted = 0L;
    for (SalaryAdvance advance : advances) {
      if (remainingGross <= 0) {
        break;
      }
      long take = Math.min(advance.getRemainingXof(), remainingGross);
      advance.setRemainingXof(advance.getRemainingXof() - take);
      salaryAdvanceRepository.save(advance);
      deducted += take;
      remainingGross -= take;
    }

    Salary salary = new Salary();
    salary.setFarmId(farmId);
    salary.setUserId(setting.getUserId());
    salary.setPeriod(period);
    salary.setGrossXof(gross);
    salary.setAdvanceDeductedXof(deducted);
    salary.setNetXof(gross - deducted);
    salary.setStatus(SalaryStatus.DUE);
    salary.setCreatedBy(userId);
    return salaryRepository.save(salary);
  }

  @Transactional
  public SalaryResponse pay(Long farmId, Long salaryId, Long userId) {
    Salary salary =
        salaryRepository
            .findById(salaryId)
            .filter(s -> farmId.equals(s.getFarmId()))
            .orElseThrow(() -> NotFoundException.of("Salary", salaryId));
    if (salary.getStatus() == SalaryStatus.PAID) {
      throw new BusinessRuleException(
          "SALARY_ALREADY_PAID", "Salary " + salaryId + " has already been paid");
    }
    salary.setStatus(SalaryStatus.PAID);
    salary.setPaidAt(LocalDateTime.now());
    Salary saved = salaryRepository.save(salary);

    if (saved.getNetXof() != null && saved.getNetXof() > 0) {
      Expense expense = new Expense();
      expense.setFarmId(farmId);
      expense.setCategoryKey("staff");
      expense.setAmountXof(saved.getNetXof());
      expense.setExpenseDate(LocalDate.now());
      expense.setLabel("Salaire " + saved.getPeriod());
      expense.setSource(ExpenseSource.SALARY);
      expense.setSalaryId(saved.getId());
      expense.setCreatedBy(userId);
      expenseRepository.save(expense);
    }

    return toResponse(saved);
  }

  @Transactional(readOnly = true)
  public List<SalaryResponse> listSalaries(Long farmId, String period) {
    List<Salary> salaries =
        period != null
            ? salaryRepository.findByFarmIdAndPeriodOrderByUserId(farmId, period)
            : salaryRepository.findByFarmIdOrderByPeriodDescUserIdAsc(farmId);
    return salaries.stream().map(SalaryService::toResponse).toList();
  }

  private void requireActiveMember(Long farmId, Long userId) {
    boolean active =
        tenancyFacade.findMembership(userId, farmId).map(UserFarmInfo::active).orElse(false);
    if (!active) {
      throw new BusinessRuleException(
          "NOT_A_MEMBER", "User " + userId + " is not an active member of farm " + farmId);
    }
  }

  private static SalarySettingResponse toSettingResponse(SalarySetting s) {
    return new SalarySettingResponse(
        s.getId(), s.getUserId(), s.getMonthlySalaryXof(), Boolean.TRUE.equals(s.getActive()));
  }

  private static SalaryResponse toResponse(Salary s) {
    return new SalaryResponse(
        s.getId(),
        s.getUserId(),
        s.getPeriod(),
        s.getGrossXof(),
        s.getAdvanceDeductedXof(),
        s.getNetXof(),
        s.getStatus().name(),
        s.getPaidAt());
  }
}
