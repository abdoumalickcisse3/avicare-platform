package com.avicare.finance.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.finance.domain.AdvanceStatus;
import com.avicare.finance.dto.request.GenerateSalariesRequest;
import com.avicare.finance.dto.request.SalarySettingRequest;
import com.avicare.finance.dto.response.AdvanceResponse;
import com.avicare.finance.dto.response.SalaryResponse;
import com.avicare.finance.dto.response.SalarySettingResponse;
import com.avicare.finance.service.AdvanceService;
import com.avicare.finance.service.SalaryService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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
 * Monthly salary settings, generation/payment, and farm-side advance decisions (Sprint B6 P2, task
 * S3). Self-service advance requests live on {@link MyAdvanceController} instead, since they are
 * not gated behind {@code module.finance} / a managerial role.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/finance")
@RequiredArgsConstructor
public class SalaryController {

  private final SalaryService salaryService;
  private final AdvanceService advanceService;

  @GetMapping("/salary-settings")
  @PreAuthorize(FinanceAccess.READ)
  public ApiResponse<List<SalarySettingResponse>> listSettings(@PathVariable Long farmId) {
    return ApiResponse.of(salaryService.listSettings(farmId));
  }

  @PutMapping("/salary-settings")
  @PreAuthorize(FinanceAccess.WRITE_MANAGER)
  public ApiResponse<SalarySettingResponse> upsertSetting(
      @PathVariable Long farmId, @RequestBody @Valid SalarySettingRequest request) {
    return ApiResponse.of(salaryService.upsertSetting(farmId, request));
  }

  @GetMapping("/salaries")
  @PreAuthorize(FinanceAccess.READ)
  public ApiResponse<List<SalaryResponse>> listSalaries(
      @PathVariable Long farmId, @RequestParam(required = false) String period) {
    return ApiResponse.of(salaryService.listSalaries(farmId, period));
  }

  @PostMapping("/salaries/generate")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(FinanceAccess.WRITE_MANAGER)
  public ApiResponse<List<SalaryResponse>> generate(
      @PathVariable Long farmId, @RequestBody @Valid GenerateSalariesRequest request) {
    return ApiResponse.of(
        salaryService.generate(farmId, request.period(), TenancyContext.currentUserId()));
  }

  @PostMapping("/salaries/{id}/pay")
  @PreAuthorize(FinanceAccess.WRITE_MANAGER)
  public ApiResponse<SalaryResponse> pay(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(salaryService.pay(farmId, id, TenancyContext.currentUserId()));
  }

  @GetMapping("/advances")
  @PreAuthorize(FinanceAccess.READ)
  public ApiResponse<List<AdvanceResponse>> listAdvances(
      @PathVariable Long farmId, @RequestParam(required = false) AdvanceStatus status) {
    return ApiResponse.of(advanceService.listFarm(farmId, status));
  }

  @PostMapping("/advances/{id}/approve")
  @PreAuthorize(FinanceAccess.WRITE_MANAGER)
  public ApiResponse<AdvanceResponse> approve(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(advanceService.approve(farmId, id, TenancyContext.currentUserId()));
  }

  @PostMapping("/advances/{id}/reject")
  @PreAuthorize(FinanceAccess.WRITE_MANAGER)
  public ApiResponse<AdvanceResponse> reject(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(advanceService.reject(farmId, id, TenancyContext.currentUserId()));
  }
}
