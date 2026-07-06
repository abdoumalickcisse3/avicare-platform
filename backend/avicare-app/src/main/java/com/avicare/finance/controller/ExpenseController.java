package com.avicare.finance.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.finance.dto.request.ExpenseRequest;
import com.avicare.finance.dto.response.ExpenseResponse;
import com.avicare.finance.dto.response.ExpenseSummaryResponse;
import com.avicare.finance.dto.response.FarmAnalyticsResponse;
import com.avicare.finance.service.ExpenseService;
import com.avicare.finance.service.FinanceAnalyticsService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Expense ledger + farm-wide financial analytics endpoints (Sprint B6). Manual expense CRUD is
 * OWNER/MANAGER only; auto-recorded expenses (PURCHASE, STOCK_ENTRY, SALARY) are read-only here and
 * rejected on edit/delete by {@link ExpenseService} (422 {@code EXPENSE_NOT_EDITABLE}).
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/finance")
@RequiredArgsConstructor
public class ExpenseController {

  private final ExpenseService expenseService;
  private final FinanceAnalyticsService financeAnalyticsService;

  @GetMapping("/expenses")
  @PreAuthorize(FinanceAccess.READ)
  public ApiResponse<List<ExpenseResponse>> list(
      @PathVariable Long farmId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) Long unitId) {
    return ApiResponse.of(expenseService.list(farmId, from, to, category, unitId));
  }

  @PostMapping("/expenses")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(FinanceAccess.WRITE_MANAGER)
  public ApiResponse<ExpenseResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid ExpenseRequest request) {
    return ApiResponse.of(expenseService.create(farmId, request, TenancyContext.currentUserId()));
  }

  @PutMapping("/expenses/{id}")
  @PreAuthorize(FinanceAccess.WRITE_MANAGER)
  public ApiResponse<ExpenseResponse> update(
      @PathVariable Long farmId,
      @PathVariable Long id,
      @RequestBody @Valid ExpenseRequest request) {
    return ApiResponse.of(expenseService.update(farmId, id, request));
  }

  @DeleteMapping("/expenses/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(FinanceAccess.WRITE_MANAGER)
  public void delete(@PathVariable Long farmId, @PathVariable Long id) {
    expenseService.delete(farmId, id);
  }

  @GetMapping("/summary")
  @PreAuthorize(FinanceAccess.READ)
  public ApiResponse<ExpenseSummaryResponse> summary(
      @PathVariable Long farmId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
    ExpenseService.Summary summary = expenseService.summary(farmId, from, to);
    List<ExpenseSummaryResponse.CategoryTotal> categories =
        summary.categories().stream()
            .map(c -> new ExpenseSummaryResponse.CategoryTotal(c.categoryKey(), c.amountXof()))
            .toList();
    return ApiResponse.of(new ExpenseSummaryResponse(categories, summary.totalXof()));
  }

  @GetMapping("/analytics")
  @PreAuthorize(FinanceAccess.READ)
  public ApiResponse<FarmAnalyticsResponse> farmAnalytics(@PathVariable Long farmId) {
    return ApiResponse.of(financeAnalyticsService.farmAnalytics(farmId));
  }
}
