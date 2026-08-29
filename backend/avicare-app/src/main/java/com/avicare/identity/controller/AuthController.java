package com.avicare.identity.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.identity.dto.request.LoginRequest;
import com.avicare.identity.dto.request.PasswordResetConfirmRequest;
import com.avicare.identity.dto.request.PasswordResetRequest;
import com.avicare.identity.dto.request.RefreshRequest;
import com.avicare.identity.dto.request.SignupRequest;
import com.avicare.identity.dto.response.AuthTokens;
import com.avicare.identity.service.AuthService;
import com.avicare.identity.service.PasswordResetService;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public authentication endpoints. All routes under {@code /api/v1/auth/**} are whitelisted in
 * {@code SecurityConfig}; {@code logout-all} additionally requires an authenticated principal.
 *
 * <p>The refresh token travels in the request body (mobile / Bearer-first). The web httpOnly-cookie
 * transport (doc 05 §3.8) is deferred.
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

  private final AuthService authService;
  private final PasswordResetService passwordResetService;

  @PostMapping("/signup")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<AuthTokens> signup(@RequestBody @Valid SignupRequest request) {
    return ApiResponse.of(authService.signup(request));
  }

  @PostMapping("/login")
  public ApiResponse<AuthTokens> login(@RequestBody @Valid LoginRequest request) {
    return ApiResponse.of(authService.login(request));
  }

  @PostMapping("/refresh")
  public ApiResponse<AuthTokens> refresh(@RequestBody @Valid RefreshRequest request) {
    return ApiResponse.of(authService.refresh(request.refreshToken()));
  }

  @PostMapping("/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(@RequestBody @Valid RefreshRequest request) {
    authService.logout(request.refreshToken());
  }

  @PostMapping("/logout-all")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logoutAll() {
    authService.logoutAll(TenancyContext.currentUserId());
  }

  /**
   * Ask for a reset code by WhatsApp.
   *
   * <p>Always 202, whatever happens. Answering differently for a known and an unknown number would
   * turn this into a public directory of who is registered on the platform.
   */
  @PostMapping("/password-reset/request")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public ApiResponse<Map<String, String>> requestPasswordReset(
      @RequestBody @Valid PasswordResetRequest request) {
    passwordResetService.requestCode(request.phone());
    return ApiResponse.of(
        Map.of(
            "message",
            "Si un compte est associé à ce numéro, un code vient d'être envoyé par WhatsApp."));
  }

  /** Verify the code and set the new password. Every session of the account is revoked. */
  @PostMapping("/password-reset/confirm")
  public ApiResponse<Map<String, String>> confirmPasswordReset(
      @RequestBody @Valid PasswordResetConfirmRequest request) {
    passwordResetService.confirm(request.phone(), request.code(), request.newPassword());
    return ApiResponse.of(Map.of("message", "Mot de passe modifié. Vous pouvez vous connecter."));
  }
}
