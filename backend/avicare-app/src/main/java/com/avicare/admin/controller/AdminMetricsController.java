package com.avicare.admin.controller;

import com.avicare.admin.dto.response.PlatformBackups;
import com.avicare.admin.dto.response.PlatformOverview;
import com.avicare.admin.dto.response.PlatformRuntime;
import com.avicare.admin.service.AdminMetricsService;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.notification.api.WhatsAppLedger;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Platform cockpit and WhatsApp spend (console Phase 3), behind {@code metrics:read}. */
@RestController
@RequestMapping("/api/v1/admin/metrics")
@RequiredArgsConstructor
public class AdminMetricsController {

  private final AdminMetricsService metricsService;

  @GetMapping("/overview")
  @PreAuthorize("@adminAccess.can('metrics:read')")
  public ApiResponse<PlatformOverview> overview() {
    return ApiResponse.of(metricsService.overview());
  }

  @GetMapping("/runtime")
  @PreAuthorize("@adminAccess.can('metrics:read')")
  public ApiResponse<PlatformRuntime> runtime() {
    return ApiResponse.of(metricsService.runtime());
  }

  @GetMapping("/backups")
  @PreAuthorize("@adminAccess.can('metrics:read')")
  public ApiResponse<PlatformBackups> backups() {
    return ApiResponse.of(metricsService.backups());
  }

  @GetMapping("/whatsapp")
  @PreAuthorize("@adminAccess.can('metrics:read')")
  public ApiResponse<WhatsAppLedger.Usage> whatsapp(@RequestParam(defaultValue = "30") int days) {
    return ApiResponse.of(metricsService.whatsappUsage(days));
  }

  @GetMapping("/whatsapp/failures")
  @PreAuthorize("@adminAccess.can('metrics:read')")
  public ApiResponse<List<WhatsAppLedger.FailedMessage>> failures() {
    return ApiResponse.of(metricsService.whatsappFailures());
  }

  /**
   * Requeue a failed message. Writing, so it needs the broadcast right rather than the read one: a
   * retry spends a credit.
   */
  @PostMapping("/whatsapp/{outboxId}/retry")
  @PreAuthorize("@adminAccess.can('broadcast:send')")
  public ApiResponse<Map<String, Boolean>> retry(@PathVariable Long outboxId) {
    return ApiResponse.of(Map.of("requeued", metricsService.retryWhatsApp(outboxId)));
  }
}
