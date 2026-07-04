package com.avicare.finance.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.finance.domain.AdvanceStatus;
import com.avicare.finance.domain.Expense;
import com.avicare.finance.domain.ExpenseSource;
import com.avicare.finance.domain.SalaryAdvance;
import com.avicare.finance.dto.response.AdvanceResponse;
import com.avicare.finance.repository.ExpenseRepository;
import com.avicare.finance.repository.SalaryAdvanceRepository;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.UserFarmInfo;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Salary advance self-requests and farm-side approval/rejection (Sprint B6 P2, design spec §5).
 * Approval is the payout: it immediately records a SALARY expense for the amount.
 */
@Service
@RequiredArgsConstructor
public class AdvanceService {

  private final SalaryAdvanceRepository salaryAdvanceRepository;
  private final ExpenseRepository expenseRepository;
  private final TenancyFacade tenancyFacade;

  @Transactional
  public AdvanceResponse requestSelf(Long farmId, Long userId, Long amountXof, String reason) {
    requireActiveMember(farmId, userId);
    SalaryAdvance advance = new SalaryAdvance();
    advance.setFarmId(farmId);
    advance.setUserId(userId);
    advance.setAmountXof(amountXof);
    advance.setReason(reason);
    advance.setStatus(AdvanceStatus.PENDING);
    advance.setRemainingXof(0L);
    return toResponse(salaryAdvanceRepository.save(advance));
  }

  @Transactional(readOnly = true)
  public List<AdvanceResponse> listSelf(Long farmId, Long userId) {
    return salaryAdvanceRepository
        .findByFarmIdAndUserIdOrderByRequestedAtDesc(farmId, userId)
        .stream()
        .map(AdvanceService::toResponse)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<AdvanceResponse> listFarm(Long farmId, AdvanceStatus status) {
    List<SalaryAdvance> advances =
        status != null
            ? salaryAdvanceRepository.findByFarmIdAndStatusOrderByRequestedAtDesc(farmId, status)
            : salaryAdvanceRepository.findByFarmIdOrderByRequestedAtDesc(farmId);
    return advances.stream().map(AdvanceService::toResponse).toList();
  }

  @Transactional
  public AdvanceResponse approve(Long farmId, Long advanceId, Long deciderId) {
    SalaryAdvance advance = loadForFarm(farmId, advanceId);
    requirePending(advance);

    advance.setStatus(AdvanceStatus.APPROVED);
    advance.setDecidedBy(deciderId);
    advance.setDecidedAt(LocalDateTime.now());
    advance.setRemainingXof(advance.getAmountXof());
    SalaryAdvance saved = salaryAdvanceRepository.save(advance);

    Expense expense = new Expense();
    expense.setFarmId(farmId);
    expense.setCategoryKey("staff");
    expense.setAmountXof(saved.getAmountXof());
    expense.setExpenseDate(LocalDate.now());
    expense.setLabel("Avance sur salaire");
    expense.setSource(ExpenseSource.SALARY);
    expense.setCreatedBy(deciderId);
    expenseRepository.save(expense);

    return toResponse(saved);
  }

  @Transactional
  public AdvanceResponse reject(Long farmId, Long advanceId, Long deciderId) {
    SalaryAdvance advance = loadForFarm(farmId, advanceId);
    requirePending(advance);

    advance.setStatus(AdvanceStatus.REJECTED);
    advance.setDecidedBy(deciderId);
    advance.setDecidedAt(LocalDateTime.now());
    return toResponse(salaryAdvanceRepository.save(advance));
  }

  private SalaryAdvance loadForFarm(Long farmId, Long advanceId) {
    return salaryAdvanceRepository
        .findById(advanceId)
        .filter(a -> farmId.equals(a.getFarmId()))
        .orElseThrow(() -> NotFoundException.of("SalaryAdvance", advanceId));
  }

  private void requirePending(SalaryAdvance advance) {
    if (advance.getStatus() != AdvanceStatus.PENDING) {
      throw new BusinessRuleException(
          "ADVANCE_NOT_PENDING", "Advance " + advance.getId() + " is not pending");
    }
  }

  private void requireActiveMember(Long farmId, Long userId) {
    boolean active =
        tenancyFacade.findMembership(userId, farmId).map(UserFarmInfo::active).orElse(false);
    if (!active) {
      throw new BusinessRuleException(
          "NOT_A_MEMBER", "User " + userId + " is not an active member of farm " + farmId);
    }
  }

  private static AdvanceResponse toResponse(SalaryAdvance a) {
    return new AdvanceResponse(
        a.getId(),
        a.getUserId(),
        a.getAmountXof(),
        a.getReason(),
        a.getStatus().name(),
        a.getRequestedAt(),
        a.getRemainingXof());
  }
}
