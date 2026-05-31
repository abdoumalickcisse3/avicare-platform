package com.avicare.tenancy.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.tenancy.dto.request.CreateFarmRequest;
import com.avicare.tenancy.dto.request.UpdateFarmRequest;
import com.avicare.tenancy.dto.response.FarmResponse;
import com.avicare.tenancy.service.FarmService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Farm CRUD. Listing and creation are open to any authenticated user (a user always sees their own
 * farms and can create a new one, becoming its OWNER). Per-farm reads/writes are guarded by the
 * tenant-level {@code @farmAccess} SpEL bean.
 */
@RestController
@RequestMapping("/api/v1/farms")
@RequiredArgsConstructor
public class FarmController {

  private final FarmService farmService;

  @GetMapping
  public ApiResponse<List<FarmResponse>> myFarms() {
    return ApiResponse.of(
        farmService.listAccessible(
            TenancyContext.currentUserId(), TenancyContext.get().isSuperAdmin()));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<FarmResponse> create(@RequestBody @Valid CreateFarmRequest request) {
    return ApiResponse.of(farmService.create(TenancyContext.currentUserId(), request));
  }

  @GetMapping("/{farmId}")
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<FarmResponse> get(@PathVariable Long farmId) {
    return ApiResponse.of(farmService.get(farmId));
  }

  @PutMapping("/{farmId}")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<FarmResponse> update(
      @PathVariable Long farmId, @RequestBody @Valid UpdateFarmRequest request) {
    return ApiResponse.of(farmService.update(farmId, request));
  }

  @DeleteMapping("/{farmId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER)")
  public void delete(@PathVariable Long farmId) {
    farmService.delete(farmId);
  }
}
