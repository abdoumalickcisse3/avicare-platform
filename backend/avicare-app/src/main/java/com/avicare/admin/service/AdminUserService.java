package com.avicare.admin.service;

import com.avicare.admin.dto.response.AdminUserRow;
import com.avicare.admin.dto.response.TemporaryPasswordResponse;
import com.avicare.common.security.util.TemporaryPasswordGenerator;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.identity.service.RefreshTokenService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Cross-tenant account support: find an account, reset it, disable it. */
@Service
@RequiredArgsConstructor
public class AdminUserService {

  private static final int MAX_RESULTS = 50;

  private final UserRepository userRepository;
  private final IdentityFacade identityFacade;
  private final RefreshTokenService refreshTokenService;
  private final AdminAuditService auditService;

  @Transactional(readOnly = true)
  public List<AdminUserRow> search(String query) {
    if (query == null || query.isBlank()) {
      return List.of();
    }
    return userRepository.search(query.trim(), PageRequest.of(0, MAX_RESULTS)).stream()
        .map(AdminUserService::toRow)
        .toList();
  }

  /** Issue a temporary password. Returned once; the caller must hand it over immediately. */
  @Transactional
  public TemporaryPasswordResponse resetPassword(Long userId) {
    String temporary = TemporaryPasswordGenerator.generate();
    identityFacade.resetPassword(userId, temporary);
    // The old password is gone, so any session still holding a refresh token must go too.
    refreshTokenService.revokeAllForUser(userId);
    auditService.record("user.password.reset", "User", userId, null, Map.of());
    return new TemporaryPasswordResponse(userId, temporary);
  }

  /**
   * Enable or disable an account. Disabling revokes every session in the same transaction:
   * otherwise the account keeps working until its access token expires, which is precisely the
   * window that matters when disabling in a hurry.
   */
  @Transactional
  public void setActive(Long userId, boolean active) {
    identityFacade.setActive(userId, active);
    if (!active) {
      refreshTokenService.revokeAllForUser(userId);
    }
    auditService.record(
        active ? "user.activate" : "user.deactivate", "User", userId, null, Map.of());
  }

  private static AdminUserRow toRow(User u) {
    return new AdminUserRow(
        u.getId(),
        u.getEmail(),
        u.getFullName(),
        u.getPhone(),
        u.getRole().name(),
        u.isActive(),
        u.getLastLoginAt());
  }
}
