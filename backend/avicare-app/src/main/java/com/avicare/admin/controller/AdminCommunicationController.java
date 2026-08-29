package com.avicare.admin.controller;

import com.avicare.admin.dto.request.AnnouncementRequest;
import com.avicare.admin.dto.request.BroadcastRequest;
import com.avicare.admin.service.BroadcastService;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.notification.api.AnnouncementView;
import com.avicare.notification.service.AnnouncementService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Announcements and WhatsApp campaigns (console Phase 4), behind {@code broadcast:send}. */
@RestController
@RequestMapping("/api/v1/admin/communication")
@RequiredArgsConstructor
public class AdminCommunicationController {

  private final AnnouncementService announcementService;
  private final BroadcastService broadcastService;

  @GetMapping("/announcements")
  @PreAuthorize("@adminAccess.can('broadcast:send')")
  public ApiResponse<List<AnnouncementView>> announcements() {
    return ApiResponse.of(announcementService.all());
  }

  @PostMapping("/announcements")
  @PreAuthorize("@adminAccess.can('broadcast:send')")
  public ApiResponse<AnnouncementView> create(@RequestBody @Valid AnnouncementRequest request) {
    return ApiResponse.of(
        announcementService.create(
            request.title(),
            request.body(),
            request.severity(),
            request.startsAt(),
            request.endsAt(),
            request.published(),
            TenancyContext.currentUserId()));
  }

  @PutMapping("/announcements/{id}")
  @PreAuthorize("@adminAccess.can('broadcast:send')")
  public ApiResponse<AnnouncementView> update(
      @PathVariable Long id, @RequestBody @Valid AnnouncementRequest request) {
    return ApiResponse.of(
        announcementService.update(
            id,
            request.title(),
            request.body(),
            request.severity(),
            request.startsAt(),
            request.endsAt(),
            request.published()));
  }

  /** How many people a campaign would actually reach, before it is sent. */
  @GetMapping("/broadcast/recipients")
  @PreAuthorize("@adminAccess.can('broadcast:send')")
  public ApiResponse<Map<String, Integer>> recipients(
      @RequestParam(required = false) List<Long> farmIds) {
    return ApiResponse.of(Map.of("count", broadcastService.recipients(farmIds).size()));
  }

  @PostMapping("/broadcast")
  @PreAuthorize("@adminAccess.can('broadcast:send')")
  public ApiResponse<Map<String, Integer>> broadcast(@RequestBody @Valid BroadcastRequest request) {
    return ApiResponse.of(
        Map.of("queued", broadcastService.send(request.message(), request.farmIds())));
  }
}
