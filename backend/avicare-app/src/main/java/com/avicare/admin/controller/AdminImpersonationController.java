package com.avicare.admin.controller;

import com.avicare.admin.dto.request.ImpersonationRequest;
import com.avicare.admin.service.ImpersonationService;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Support sessions (console Phase 1).
 *
 * <p>{@link ImpersonationService} was written with the rest of Phase 1 but never exposed: the
 * console's "Mode support" button called a route that did not exist. Found by listing the deployed
 * routes — the service had tests, the front had a button, and the gap sat precisely between them.
 *
 * <p>The returned token carries the <b>target's</b> identity and memberships, so the staff member
 * sees what the farmer sees, missing permissions included. It is short-lived and cannot be renewed.
 */
@RestController
@RequestMapping("/api/v1/admin/impersonate")
@RequiredArgsConstructor
public class AdminImpersonationController {

  private final ImpersonationService impersonationService;

  @PostMapping
  @PreAuthorize("@adminAccess.can('impersonate:open')")
  public ApiResponse<Map<String, String>> open(@RequestBody @Valid ImpersonationRequest request) {
    String token =
        impersonationService.open(
            TenancyContext.currentUserId(), request.userId(), request.reason());
    return ApiResponse.of(Map.of("accessToken", token));
  }

  /**
   * Record the end of a session.
   *
   * <p>Nothing is revoked here — the token expires on its own — but the trail needs both ends to
   * say how long staff spent inside a farmer's account.
   */
  @PostMapping("/{userId}/close")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("@adminAccess.can('impersonate:open')")
  public ApiResponse<Void> close(@PathVariable Long userId) {
    impersonationService.close(TenancyContext.currentUserId(), userId);
    return ApiResponse.of(null);
  }
}
