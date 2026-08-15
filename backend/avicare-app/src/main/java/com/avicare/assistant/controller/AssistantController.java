package com.avicare.assistant.controller;

import com.avicare.assistant.audit.AssistantAuditService;
import com.avicare.assistant.audit.AssistantQuotaService;
import com.avicare.assistant.confirm.PendingActionService;
import com.avicare.assistant.confirm.PendingActionService.ConfirmResult;
import com.avicare.assistant.dto.ConfirmRequest;
import com.avicare.assistant.dto.InterpretRequest;
import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.assistant.service.InterpretService;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Assistant gateway. {@code interpret} turns text into a confirmable draft (or a
 * clarification/answer) — it reads/validates only, never writes. Two confirm paths coexist: the
 * mobile confirms on the existing field endpoints, and {@code confirm} executes a stored claim
 * server-side (the additional path). Gated by farm access; each write still enforces the action's
 * own permission downstream.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/assistant")
@RequiredArgsConstructor
public class AssistantController {

  private final InterpretService interpretService;
  private final AssistantAuditService auditService;
  private final AssistantQuotaService quotaService;
  private final PendingActionService pendingActions;

  @PostMapping("/interpret")
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<InterpretResponse> interpret(
      @PathVariable Long farmId, @RequestBody @Valid InterpretRequest request) {
    Long userId = TenancyContext.currentUserId();

    // Cost guard: turn the user away before the LLM once the daily cap is reached
    // (not counted against the quota, not audited — it never reached the model).
    if (quotaService.isExhausted(userId)) {
      return ApiResponse.of(
          InterpretResponse.clarification(
              "Vous avez atteint votre limite d'assistant pour aujourd'hui ("
                  + quotaService.dailyQuota()
                  + " demandes). Réessayez demain."));
    }

    InterpretResponse response =
        interpretService.interpret(farmId, userId, request.text(), request.unitId());
    // A write draft also gets a short-lived server claim, so a server-confirm client can execute
    // it.
    if ("DRAFT".equals(response.kind())) {
      response = response.withClaimId(pendingActions.claim(farmId, userId, response));
    }
    auditService.record(farmId, userId, request.text(), response);
    return ApiResponse.of(response);
  }

  @PostMapping("/confirm")
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<ConfirmResult> confirm(
      @PathVariable Long farmId, @RequestBody @Valid ConfirmRequest request) {
    Long userId = TenancyContext.currentUserId();
    ConfirmResult result = pendingActions.confirm(farmId, userId, request.claimId());
    auditService.recordAction(farmId, userId, result.action(), "CONFIRMED", result.summary());
    return ApiResponse.of(result);
  }
}
