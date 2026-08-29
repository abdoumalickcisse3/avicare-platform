package com.avicare.admin.controller;

import com.avicare.admin.dto.request.UpdateStaffPermissionsRequest;
import com.avicare.admin.dto.response.StaffMemberRow;
import com.avicare.admin.service.StaffAdminService;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.security.access.StaffPermissionCatalog;
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
 * Managing the platform staff itself (super-admin console).
 *
 * <p>Every route requires {@code staff:manage} — the permission that was in the catalog from the
 * start with nothing behind it, which is why granting a right meant editing production by hand.
 */
@RestController
@RequestMapping("/api/v1/admin/staff")
@RequiredArgsConstructor
public class AdminStaffController {

  private final StaffAdminService staffAdminService;

  @GetMapping
  @PreAuthorize("@adminAccess.can('staff:manage')")
  public ApiResponse<List<StaffMemberRow>> list() {
    return ApiResponse.of(staffAdminService.list());
  }

  /** The assignable taxonomy, so the screen renders it instead of duplicating it. */
  @GetMapping("/catalog")
  @PreAuthorize("@adminAccess.can('staff:manage')")
  public ApiResponse<List<StaffPermissionCatalog.ResourceDef>> catalog() {
    return ApiResponse.of(staffAdminService.catalog());
  }

  @PostMapping("/{userId}")
  @PreAuthorize("@adminAccess.can('staff:manage')")
  public ApiResponse<StaffMemberRow> grant(@PathVariable Long userId) {
    return ApiResponse.of(staffAdminService.grantStaff(userId));
  }

  @DeleteMapping("/{userId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("@adminAccess.can('staff:manage')")
  public ApiResponse<Void> revoke(@PathVariable Long userId) {
    staffAdminService.revokeStaff(userId);
    return ApiResponse.of(null);
  }

  @PutMapping("/{userId}/permissions")
  @PreAuthorize("@adminAccess.can('staff:manage')")
  public ApiResponse<StaffMemberRow> setPermissions(
      @PathVariable Long userId, @RequestBody @Valid UpdateStaffPermissionsRequest request) {
    return ApiResponse.of(staffAdminService.setPermissions(userId, request.permissions()));
  }
}
