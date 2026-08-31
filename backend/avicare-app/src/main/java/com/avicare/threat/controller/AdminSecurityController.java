package com.avicare.threat.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.threat.domain.BlockedIp;
import com.avicare.threat.domain.SecurityEvent;
import com.avicare.threat.dto.BlockIpRequest;
import com.avicare.threat.dto.BlockedIpRow;
import com.avicare.threat.dto.SecurityEventRow;
import com.avicare.threat.dto.SecurityOverview;
import com.avicare.threat.service.ThreatDetectionService;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The security screen ({@code /console/securite}).
 *
 * <p>{@code security:read} to look, {@code security:manage} to block or release an address —
 * unblocking is how a wrongly-caught farmer gets back in, and it should be traceable to whoever did
 * it.
 */
@RestController
@RequestMapping("/api/v1/admin/security")
@RequiredArgsConstructor
public class AdminSecurityController {

  private final ThreatDetectionService threatDetection;

  @GetMapping
  @PreAuthorize("@adminAccess.can('security:read')")
  public ApiResponse<SecurityOverview> overview(@RequestParam(defaultValue = "7") int days) {
    int window = Math.min(Math.max(days, 1), 90);
    return ApiResponse.of(
        new SecurityOverview(
            threatDetection.counters(window),
            threatDetection.recentEvents(window).stream()
                .map(AdminSecurityController::toRow)
                .toList(),
            threatDetection.activeBlocks().stream().map(AdminSecurityController::toRow).toList()));
  }

  @PostMapping("/block")
  @PreAuthorize("@adminAccess.can('security:manage')")
  public ApiResponse<BlockedIpRow> block(@Valid @RequestBody BlockIpRequest request) {
    BlockedIp blocked =
        threatDetection.block(
            request.ipAddress().trim(),
            request.reason(),
            currentActor(),
            Duration.ofMinutes(request.minutes() == null ? 60 : request.minutes()));
    return ApiResponse.of(toRow(blocked));
  }

  @PostMapping("/unblock")
  @PreAuthorize("@adminAccess.can('security:manage')")
  public ApiResponse<Void> unblock(@Valid @RequestBody BlockIpRequest request) {
    threatDetection.unblock(request.ipAddress().trim(), currentActor(), request.reason());
    return ApiResponse.of(null);
  }

  private static SecurityEventRow toRow(SecurityEvent event) {
    return new SecurityEventRow(
        event.getId(),
        event.getEventType(),
        event.getSeverity(),
        event.getIpAddress(),
        event.getEmail(),
        event.getUserAgent(),
        event.getDetails(),
        event.getActionTaken(),
        event.getCreatedAt());
  }

  private static BlockedIpRow toRow(BlockedIp blocked) {
    long remaining =
        Math.max(Duration.between(LocalDateTime.now(), blocked.getBlockedUntil()).toMinutes(), 0);
    return new BlockedIpRow(
        blocked.getIpAddress(),
        blocked.getBlockedAt(),
        blocked.getBlockedUntil(),
        remaining,
        blocked.getReason(),
        blocked.getBlockedBy());
  }

  /** The staff member's email: a block is a decision, and decisions have authors. */
  private static String currentActor() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getDetails() instanceof AvicarePrincipal principal) {
      return principal.email() == null ? String.valueOf(principal.userId()) : principal.email();
    }
    return "unknown";
  }
}
