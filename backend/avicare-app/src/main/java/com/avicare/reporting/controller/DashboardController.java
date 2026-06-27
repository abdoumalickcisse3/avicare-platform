package com.avicare.reporting.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.reporting.api.dto.DashboardResponse;
import com.avicare.reporting.domain.DashboardPeriod;
import com.avicare.reporting.service.ReportingService;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Tableau de bord cross-module, par ferme (Spec B). Tout membre de la ferme ; sections gatées. */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/dashboard")
@RequiredArgsConstructor
public class DashboardController {

  private final ReportingService reportingService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<DashboardResponse> get(
      @PathVariable Long farmId,
      @RequestParam(required = false) String period,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
    DashboardPeriod resolved = DashboardPeriod.resolve(period, from, to, LocalDate.now());
    return ApiResponse.of(reportingService.buildDashboard(farmId, resolved));
  }
}
