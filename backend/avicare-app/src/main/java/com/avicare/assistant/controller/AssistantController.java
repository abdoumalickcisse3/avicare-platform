package com.avicare.assistant.controller;

import com.avicare.assistant.audit.AssistantAuditService;
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
 * Assistant gateway. {@code interpret} turns text into a confirmable draft (or a clarification) —
 * it reads/validates only, never writes. Gated by farm access; the real write still happens on the
 * mobile "Confirmer" → the existing field endpoints, which enforce the action's write permission.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/assistant")
@RequiredArgsConstructor
public class AssistantController {

  private final InterpretService interpretService;
  private final AssistantAuditService auditService;

  @PostMapping("/interpret")
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<InterpretResponse> interpret(
      @PathVariable Long farmId, @RequestBody @Valid InterpretRequest request) {
    InterpretResponse response =
        interpretService.interpret(farmId, request.text(), request.unitId());
    auditService.record(farmId, TenancyContext.currentUserId(), request.text(), response);
    return ApiResponse.of(response);
  }
}
