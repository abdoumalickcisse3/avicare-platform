package com.avicare.admin.controller;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.identity.service.RefreshTokenService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Session control for support (super-admin console, Phase 0 "light O" compromise).
 *
 * <p>Revoking sessions is the immediate lever when an account is compromised, and it is what makes
 * deactivation actually bite: without it, a disabled account keeps working until its access token
 * expires.
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminSessionController {

  private final RefreshTokenService refreshTokenService;
  private final AdminAuditService auditService;

  @PostMapping("/{userId}/revoke-sessions")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("@adminAccess.can('users:deactivate')")
  public ApiResponse<Void> revokeSessions(@PathVariable Long userId) {
    refreshTokenService.revokeAllForUser(userId);
    auditService.record("user.sessions.revoke", "User", userId, null, Map.of());
    return ApiResponse.of(null);
  }
}
