package com.avicare.identity.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.identity.dto.request.UpdateProfileRequest;
import com.avicare.identity.dto.response.UserResponse;
import com.avicare.identity.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authenticated account endpoints. The user id comes from the {@link TenancyContext} populated by
 * {@code JwtFilter}, so a caller can only ever read or edit their own profile.
 */
@RestController
@RequestMapping("/api/v1/account")
@RequiredArgsConstructor
public class AccountController {

  private final AuthService authService;

  @GetMapping("/profile")
  public ApiResponse<UserResponse> profile() {
    return ApiResponse.of(authService.profile(TenancyContext.currentUserId()));
  }

  @PutMapping("/profile")
  public ApiResponse<UserResponse> updateProfile(@RequestBody @Valid UpdateProfileRequest request) {
    return ApiResponse.of(authService.updateProfile(TenancyContext.currentUserId(), request));
  }
}
