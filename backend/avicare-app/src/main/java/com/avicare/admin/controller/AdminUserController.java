package com.avicare.admin.controller;

import com.avicare.admin.dto.response.AdminUserRow;
import com.avicare.admin.dto.response.TemporaryPasswordResponse;
import com.avicare.admin.service.AdminUserService;
import com.avicare.common.api.response.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Cross-tenant account support (super-admin console, Phase 1). */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

  private final AdminUserService userService;

  @GetMapping
  @PreAuthorize("@adminAccess.can('users:read')")
  public ApiResponse<List<AdminUserRow>> search(@RequestParam(required = false) String q) {
    return ApiResponse.of(userService.search(q));
  }

  @PostMapping("/{userId}/reset-password")
  @PreAuthorize("@adminAccess.can('users:reset-password')")
  public ApiResponse<TemporaryPasswordResponse> resetPassword(@PathVariable Long userId) {
    return ApiResponse.of(userService.resetPassword(userId));
  }

  @PostMapping("/{userId}/deactivate")
  @PreAuthorize("@adminAccess.can('users:deactivate')")
  public ApiResponse<Void> deactivate(@PathVariable Long userId) {
    userService.setActive(userId, false);
    return ApiResponse.of(null);
  }

  @PostMapping("/{userId}/activate")
  @PreAuthorize("@adminAccess.can('users:deactivate')")
  public ApiResponse<Void> activate(@PathVariable Long userId) {
    userService.setActive(userId, true);
    return ApiResponse.of(null);
  }
}
