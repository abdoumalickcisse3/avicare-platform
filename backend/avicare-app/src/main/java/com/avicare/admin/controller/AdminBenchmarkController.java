package com.avicare.admin.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.benchmark.BenchmarkService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The cohort as staff sees it (console Phase 5, differentiator I).
 *
 * <p>Read-only. Turning comparison on and moving the cohort floor is done through the catalog entry
 * that stores them, so there is one place where a platform setting lives — the same one V42
 * established for the health thresholds.
 */
@RestController
@RequestMapping("/api/v1/admin/benchmarks")
@RequiredArgsConstructor
public class AdminBenchmarkController {

  private final BenchmarkService benchmarkService;

  @GetMapping
  @PreAuthorize("@adminAccess.can('metrics:read')")
  public ApiResponse<Map<String, Object>> overview() {
    BenchmarkService.Settings settings = benchmarkService.settings();
    BenchmarkService.Comparison platform = benchmarkService.comparison(null);
    return ApiResponse.of(
        Map.of(
            "enabled", settings.enabled(),
            "minCohort", settings.minCohort(),
            "cohortSize", platform.cohortSize(),
            "available", platform.available(),
            // Null when the cohort is too small: staff sees the floor working, not a leak.
            "platformMortalityRate",
                platform.platformMortalityRate() == null
                    ? "—"
                    : platform.platformMortalityRate().toPlainString()));
  }
}
