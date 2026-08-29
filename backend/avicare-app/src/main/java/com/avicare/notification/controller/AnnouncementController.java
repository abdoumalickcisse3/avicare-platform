package com.avicare.notification.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.notification.api.AnnouncementView;
import com.avicare.notification.service.AnnouncementService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * What every signed-in user should see right now.
 *
 * <p>No permission beyond being authenticated: an announcement is addressed to everyone, and gating
 * it behind a farm right would hide a platform message from the people it concerns.
 */
@RestController
@RequestMapping("/api/v1/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

  private final AnnouncementService announcementService;

  @GetMapping
  public ApiResponse<List<AnnouncementView>> active() {
    return ApiResponse.of(announcementService.active());
  }
}
