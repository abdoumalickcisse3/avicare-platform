package com.avicare.finance.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.finance.dto.request.AdvanceRequest;
import com.avicare.finance.dto.response.AdvanceResponse;
import com.avicare.finance.service.AdvanceService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Self-service salary advance requests (Sprint B6 P2, task S3). Deliberately NOT gated behind
 * {@link FinanceAccess} — any farm member can request/browse their own advances regardless of
 * {@code module.finance} or {@code finance:read}; only farm membership ({@code
 * farmAccess.hasAccess}) is required. The acting user always comes from {@link TenancyContext},
 * never from the request body.
 */
@RestController
@RequestMapping("/api/v1/my/advances")
@RequiredArgsConstructor
public class MyAdvanceController {

  private final AdvanceService advanceService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<AdvanceResponse>> mine(@RequestParam Long farmId) {
    return ApiResponse.of(advanceService.listSelf(farmId, TenancyContext.currentUserId()));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("@farmAccess.hasAccess(#request.farmId())")
  public ApiResponse<AdvanceResponse> request(@RequestBody @Valid AdvanceRequest request) {
    return ApiResponse.of(
        advanceService.requestSelf(
            request.farmId(),
            TenancyContext.currentUserId(),
            request.amountXof(),
            request.reason()));
  }
}
