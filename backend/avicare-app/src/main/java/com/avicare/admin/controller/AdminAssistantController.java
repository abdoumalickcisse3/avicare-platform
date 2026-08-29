package com.avicare.admin.controller;

import com.avicare.admin.service.AssistantReviewService;
import com.avicare.common.api.response.ApiResponse;
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

/**
 * Supervising the assistant (console Phase 5, differentiator L).
 *
 * <p>Two permissions, not one: reading a farmer's conversation is closer to opening a support
 * session than to reading a counter, and turning the assistant off for a farm changes what that
 * farm can do. Someone auditing answer quality has no business doing the second.
 */
@RestController
@RequestMapping("/api/v1/admin/assistant")
@RequiredArgsConstructor
public class AdminAssistantController {

  private final AssistantReviewService reviewService;

  @GetMapping("/turns")
  @PreAuthorize("@adminAccess.can('assistant:review')")
  public ApiResponse<List<AssistantReviewService.Turn>> turns(
      @RequestParam(required = false) Long farmId, @RequestParam(defaultValue = "20") int limit) {
    return ApiResponse.of(reviewService.recentTurns(farmId, limit));
  }

  @GetMapping("/stats")
  @PreAuthorize("@adminAccess.can('assistant:review')")
  public ApiResponse<Map<String, Long>> stats(@RequestParam(defaultValue = "30") int days) {
    return ApiResponse.of(reviewService.kindBreakdown(days));
  }

  @GetMapping("/farms/{farmId}")
  @PreAuthorize("@adminAccess.can('assistant:review')")
  public ApiResponse<Map<String, Boolean>> status(@PathVariable Long farmId) {
    return ApiResponse.of(Map.of("enabled", reviewService.isEnabledFor(farmId)));
  }

  @PostMapping("/farms/{farmId}/enable")
  @PreAuthorize("@adminAccess.can('assistant:configure')")
  public ApiResponse<Map<String, Boolean>> enable(@PathVariable Long farmId) {
    reviewService.setEnabledFor(farmId, true);
    return ApiResponse.of(Map.of("enabled", true));
  }

  @PostMapping("/farms/{farmId}/disable")
  @PreAuthorize("@adminAccess.can('assistant:configure')")
  public ApiResponse<Map<String, Boolean>> disable(@PathVariable Long farmId) {
    reviewService.setEnabledFor(farmId, false);
    return ApiResponse.of(Map.of("enabled", false));
  }
}
