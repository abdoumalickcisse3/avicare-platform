package com.avicare.tenancy.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.tenancy.dto.request.AddMemberRequest;
import com.avicare.tenancy.dto.request.UpdateMemberRequest;
import com.avicare.tenancy.dto.response.MemberResponse;
import com.avicare.tenancy.service.MembershipService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Farm membership management. Reading the roster needs farm access; mutating it (invite, change
 * role, remove) is restricted to OWNER/MANAGER via the {@code @farmAccess} SpEL bean.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/users")
@RequiredArgsConstructor
public class FarmMemberController {

  private final MembershipService membershipService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<List<MemberResponse>> list(@PathVariable Long farmId) {
    return ApiResponse.of(membershipService.listMembers(farmId));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<MemberResponse> add(
      @PathVariable Long farmId, @RequestBody @Valid AddMemberRequest request) {
    return ApiResponse.of(membershipService.addMember(farmId, request));
  }

  @PutMapping("/{userId}")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<MemberResponse> update(
      @PathVariable Long farmId,
      @PathVariable Long userId,
      @RequestBody @Valid UpdateMemberRequest request) {
    return ApiResponse.of(membershipService.updateMember(farmId, userId, request));
  }

  @DeleteMapping("/{userId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public void remove(@PathVariable Long farmId, @PathVariable Long userId) {
    membershipService.removeMember(farmId, userId);
  }
}
