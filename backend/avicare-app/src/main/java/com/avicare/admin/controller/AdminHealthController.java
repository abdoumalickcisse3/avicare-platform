package com.avicare.admin.controller;

import com.avicare.admin.dto.response.FarmHealthRow;
import com.avicare.admin.service.FarmHealthScoreService;
import com.avicare.common.api.response.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Anti-churn view: the farms worth a call (super-admin console, Phase 1). */
@RestController
@RequestMapping("/api/v1/admin/health")
@RequiredArgsConstructor
public class AdminHealthController {

  private final FarmHealthScoreService healthScoreService;

  @GetMapping("/farms-at-risk")
  @PreAuthorize("@adminAccess.can('tenants:read')")
  public ApiResponse<List<FarmHealthRow>> farmsAtRisk() {
    return ApiResponse.of(healthScoreService.farmsAtRisk());
  }
}
