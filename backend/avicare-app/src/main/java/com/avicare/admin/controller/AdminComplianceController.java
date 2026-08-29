package com.avicare.admin.controller;

import com.avicare.admin.dto.request.PurgeFarmRequest;
import com.avicare.admin.dto.response.FarmPurgePreview;
import com.avicare.admin.service.ComplianceService;
import com.avicare.common.api.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Portability and erasure (console Phase 2).
 *
 * <p>Reading and erasing are split across two permissions on purpose: {@code compliance:export}
 * answers a farmer asking for their data, {@code compliance:delete} destroys it. Nobody should hold
 * the second by accident of holding the first.
 */
@RestController
@RequestMapping("/api/v1/admin/compliance")
@RequiredArgsConstructor
public class AdminComplianceController {

  private final ComplianceService complianceService;

  @GetMapping("/farms/{farmId}/export")
  @PreAuthorize("@adminAccess.can('compliance:export')")
  public ApiResponse<Map<String, Object>> exportFarm(@PathVariable Long farmId) {
    return ApiResponse.of(complianceService.exportFarm(farmId));
  }

  @GetMapping("/farms/deleted")
  @PreAuthorize("@adminAccess.can('compliance:export')")
  public ApiResponse<List<FarmPurgePreview>> deletedFarms() {
    return ApiResponse.of(complianceService.deletedFarms());
  }

  @GetMapping("/farms/{farmId}/purge-preview")
  @PreAuthorize("@adminAccess.can('compliance:delete')")
  public ApiResponse<FarmPurgePreview> purgePreview(@PathVariable Long farmId) {
    return ApiResponse.of(complianceService.purgePreview(farmId));
  }

  @DeleteMapping("/farms/{farmId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("@adminAccess.can('compliance:delete')")
  public ApiResponse<Void> purgeFarm(
      @PathVariable Long farmId, @RequestBody @Valid PurgeFarmRequest request) {
    complianceService.purgeFarm(farmId, request.confirmationName());
    return ApiResponse.of(null);
  }

  @PostMapping("/users/{userId}/anonymize")
  @PreAuthorize("@adminAccess.can('compliance:delete')")
  public ApiResponse<Map<String, String>> anonymizeUser(@PathVariable Long userId) {
    return ApiResponse.of(Map.of("email", complianceService.anonymizeUser(userId)));
  }
}
