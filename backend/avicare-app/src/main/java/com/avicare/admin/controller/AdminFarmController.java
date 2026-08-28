package com.avicare.admin.controller;

import com.avicare.admin.dto.response.AdminFarmDetail;
import com.avicare.admin.dto.response.AdminFarmRow;
import com.avicare.admin.service.AdminFarmReadService;
import com.avicare.common.api.response.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Farm directory and 360° sheet for support (super-admin console, Phase 1). */
@RestController
@RequestMapping("/api/v1/admin/farms")
@RequiredArgsConstructor
public class AdminFarmController {

  private final AdminFarmReadService readService;

  @GetMapping
  @PreAuthorize("@adminAccess.can('tenants:read')")
  public ApiResponse<List<AdminFarmRow>> list(@RequestParam(required = false) String q) {
    return ApiResponse.of(readService.list(q));
  }

  @GetMapping("/{farmId}")
  @PreAuthorize("@adminAccess.can('tenants:read')")
  public ApiResponse<AdminFarmDetail> detail(@PathVariable Long farmId) {
    return ApiResponse.of(readService.detail(farmId));
  }
}
