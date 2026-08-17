package com.avicare.notification.controller;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.api.response.PageResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.notification.dto.NotificationResponse;
import com.avicare.notification.dto.PreferenceResponse;
import com.avicare.notification.dto.UnreadCountResponse;
import com.avicare.notification.dto.UpdatePreferencesRequest;
import com.avicare.notification.service.NotificationScannerService;
import com.avicare.notification.service.NotificationService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Notification bell + preferences endpoints (Sprint C1). Farm-scoped; read state and preferences
 * are per authenticated user. All routes gated on farm membership ({@link
 * NotificationAccess#ACCESS}).
 */
@RestController
@RequiredArgsConstructor
public class NotificationController {

  private final NotificationService notificationService;
  private final NotificationScannerService scannerService;

  @Value("${notifications.scan.manual-trigger-enabled:true}")
  private boolean manualTriggerEnabled;

  @GetMapping("/api/v1/farms/{farmId}/notifications")
  @PreAuthorize(NotificationAccess.ACCESS)
  public PageResponse<NotificationResponse> list(
      @PathVariable Long farmId,
      @RequestParam(defaultValue = "false") boolean unread,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    Long userId = TenancyContext.currentUserId();
    return PageResponse.from(
        notificationService.feed(farmId, userId, unread, PageRequest.of(page, size)));
  }

  @GetMapping("/api/v1/farms/{farmId}/notifications/unread-count")
  @PreAuthorize(NotificationAccess.ACCESS)
  public ApiResponse<UnreadCountResponse> unreadCount(@PathVariable Long farmId) {
    Long userId = TenancyContext.currentUserId();
    return ApiResponse.of(new UnreadCountResponse(notificationService.unreadCount(farmId, userId)));
  }

  @PostMapping("/api/v1/farms/{farmId}/notifications/{id}/read")
  @PreAuthorize(NotificationAccess.ACCESS)
  public ApiResponse<Void> markRead(@PathVariable Long farmId, @PathVariable Long id) {
    notificationService.markRead(farmId, TenancyContext.currentUserId(), id);
    return ApiResponse.of(null);
  }

  @PostMapping("/api/v1/farms/{farmId}/notifications/read-all")
  @PreAuthorize(NotificationAccess.ACCESS)
  public ApiResponse<Void> markAllRead(@PathVariable Long farmId) {
    notificationService.markAllRead(farmId, TenancyContext.currentUserId());
    return ApiResponse.of(null);
  }

  @GetMapping("/api/v1/farms/{farmId}/notification-preferences")
  @PreAuthorize(NotificationAccess.ACCESS)
  public ApiResponse<List<PreferenceResponse>> getPreferences(@PathVariable Long farmId) {
    return ApiResponse.of(
        notificationService.getPreferences(farmId, TenancyContext.currentUserId()));
  }

  @PutMapping("/api/v1/farms/{farmId}/notification-preferences")
  @PreAuthorize(NotificationAccess.ACCESS)
  public ApiResponse<Void> updatePreferences(
      @PathVariable Long farmId, @RequestBody @Valid UpdatePreferencesRequest request) {
    notificationService.updatePreferences(farmId, TenancyContext.currentUserId(), request);
    return ApiResponse.of(null);
  }

  /**
   * Dev/manual trigger of the daily scan for a farm (integration testing). Disabled in prod via
   * {@code notifications.scan.manual-trigger-enabled=false} — returns 404 there so it looks absent.
   */
  @PostMapping("/api/v1/farms/{farmId}/notifications/scan")
  @PreAuthorize(NotificationAccess.ACCESS)
  public ApiResponse<Void> scan(@PathVariable Long farmId) {
    if (!manualTriggerEnabled) {
      throw NotFoundException.of("Endpoint", farmId);
    }
    scannerService.scanFarm(farmId);
    return ApiResponse.of(null);
  }
}
