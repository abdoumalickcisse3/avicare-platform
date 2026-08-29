package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.benchmark.BenchmarkService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * "You versus the average", for a farm that has access to it.
 *
 * <p>Farm-scoped like every tenant route: the caller must be a member of the farm they ask about,
 * and the answer never names another farm — only the cohort's mean. Membership is enough here; a
 * comparison is not a privileged read of one's own farm.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/benchmarks")
@RequiredArgsConstructor
public class BenchmarkController {

  private final BenchmarkService benchmarkService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<BenchmarkService.Comparison> comparison(@PathVariable Long farmId) {
    return ApiResponse.of(benchmarkService.comparison(farmId));
  }
}
