package com.avicare.admin.controller;

import com.avicare.admin.dto.request.FlagEnabledRequest;
import com.avicare.admin.dto.request.KillswitchRequest;
import com.avicare.admin.dto.response.FeatureFlagRow;
import com.avicare.admin.dto.response.FlagHistoryEntry;
import com.avicare.admin.service.AdminFlagService;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.security.principal.AvicarePrincipal;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The emergency screen ({@code /console/urgence}), behind the new {@code flags:manage}.
 *
 * <p>Its own permission rather than {@code metrics:read} or {@code tenants:write}: this is the only
 * place in the console where one click changes what every farm on the platform is served. That is
 * not the same authority as reading a dashboard, and it should be grantable — or withheld — on its
 * own.
 */
@RestController
@RequestMapping("/api/v1/admin/flags")
@RequiredArgsConstructor
public class AdminFlagController {

  private final AdminFlagService flagService;

  @GetMapping
  @PreAuthorize("@adminAccess.can('flags:manage')")
  public ApiResponse<List<FeatureFlagRow>> list() {
    return ApiResponse.of(flagService.list());
  }

  @GetMapping("/history")
  @PreAuthorize("@adminAccess.can('flags:manage')")
  public ApiResponse<List<FlagHistoryEntry>> history() {
    return ApiResponse.of(flagService.history());
  }

  @PostMapping("/{flagKey}/killswitch")
  @PreAuthorize("@adminAccess.can('flags:manage')")
  public ApiResponse<FeatureFlagRow> activate(
      @PathVariable String flagKey, @Valid @RequestBody KillswitchRequest request) {
    return ApiResponse.of(flagService.activate(flagKey, request.reason(), currentUserId()));
  }

  @PostMapping("/{flagKey}/killswitch/extend")
  @PreAuthorize("@adminAccess.can('flags:manage')")
  public ApiResponse<FeatureFlagRow> extend(@PathVariable String flagKey) {
    return ApiResponse.of(flagService.extend(flagKey, currentUserId()));
  }

  @PostMapping("/{flagKey}/killswitch/lift")
  @PreAuthorize("@adminAccess.can('flags:manage')")
  public ApiResponse<FeatureFlagRow> lift(@PathVariable String flagKey) {
    return ApiResponse.of(flagService.lift(flagKey, currentUserId()));
  }

  @PutMapping("/{flagKey}/enabled")
  @PreAuthorize("@adminAccess.can('flags:manage')")
  public ApiResponse<FeatureFlagRow> setEnabled(
      @PathVariable String flagKey, @Valid @RequestBody FlagEnabledRequest request) {
    return ApiResponse.of(flagService.setEnabled(flagKey, request.enabled(), currentUserId()));
  }

  /** The staff member behind the change — read the way the platform reads it (see JwtFilter). */
  private static Long currentUserId() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    return auth != null && auth.getDetails() instanceof AvicarePrincipal principal
        ? principal.effectiveActorId()
        : null;
  }
}
