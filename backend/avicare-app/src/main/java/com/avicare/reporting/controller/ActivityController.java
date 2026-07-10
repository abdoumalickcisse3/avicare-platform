package com.avicare.reporting.controller;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.reporting.service.ActivityService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Recent-activity feed for a farm (reporting). Any farm member; limit capped at 50. */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/activity")
@RequiredArgsConstructor
public class ActivityController {

  private final ActivityService activityService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<ActivityItem>> get(
      @PathVariable Long farmId, @RequestParam(defaultValue = "20") int limit) {
    int capped = Math.max(1, Math.min(limit, 50));
    return ApiResponse.of(activityService.recentActivity(farmId, capped));
  }
}
