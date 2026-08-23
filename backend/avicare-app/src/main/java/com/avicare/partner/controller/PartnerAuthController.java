package com.avicare.partner.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.partner.dto.request.PartnerLoginRequest;
import com.avicare.partner.dto.request.PartnerRefreshRequest;
import com.avicare.partner.dto.response.PartnerAuthTokens;
import com.avicare.partner.service.PartnerAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public partner-portal auth endpoints (under the permitAll /api/v1/partner/auth/**). */
@RestController
@RequestMapping("/api/v1/partner/auth")
@RequiredArgsConstructor
public class PartnerAuthController {

  private final PartnerAuthService partnerAuthService;

  @PostMapping("/login")
  public ApiResponse<PartnerAuthTokens> login(@RequestBody @Valid PartnerLoginRequest req) {
    return ApiResponse.of(partnerAuthService.login(req));
  }

  @PostMapping("/refresh")
  public ApiResponse<PartnerAuthTokens> refresh(@RequestBody @Valid PartnerRefreshRequest req) {
    return ApiResponse.of(partnerAuthService.refresh(req.refreshToken()));
  }

  @PostMapping("/logout")
  public ApiResponse<Void> logout(@RequestBody @Valid PartnerRefreshRequest req) {
    partnerAuthService.logout(req.refreshToken());
    return ApiResponse.of(null);
  }
}
