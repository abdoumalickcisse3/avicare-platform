package com.avicare.identity.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.identity.dto.request.ChangePasswordRequest;
import com.avicare.identity.dto.request.DeleteAccountRequest;
import com.avicare.identity.dto.request.UpdateProfileRequest;
import com.avicare.identity.dto.response.UserResponse;
import com.avicare.identity.service.AccountDeletionService;
import com.avicare.identity.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
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
  private final AccountDeletionService accountDeletionService;

  @GetMapping("/profile")
  public ApiResponse<UserResponse> profile() {
    return ApiResponse.of(authService.profile(TenancyContext.currentUserId()));
  }

  @PutMapping("/profile")
  public ApiResponse<UserResponse> updateProfile(@RequestBody @Valid UpdateProfileRequest request) {
    return ApiResponse.of(authService.updateProfile(TenancyContext.currentUserId(), request));
  }

  /**
   * Change your own password. Every session is revoked, so the caller signs in again.
   *
   * <p>No permission check beyond being authenticated: the current password is the proof, and it is
   * the one action every account must be able to perform on itself without asking anyone.
   */
  @PostMapping("/password")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public ApiResponse<Void> changePassword(@RequestBody @Valid ChangePasswordRequest request) {
    authService.changePassword(TenancyContext.currentUserId(), request);
    return ApiResponse.of(null);
  }

  /**
   * What closing this account would destroy — asked before the confirmation, never after.
   *
   * <p>The count of owned farms is the whole point: it is the difference between losing a login and
   * losing a farm's entire history.
   */
  @GetMapping("/deletion-preview")
  public ApiResponse<AccountDeletionService.AccountDeletionPreview> deletionPreview() {
    return ApiResponse.of(accountDeletionService.preview(TenancyContext.currentUserId()));
  }

  /**
   * Close your own account, from inside the app.
   *
   * <p>Required by App Store rule 5.1.1(v): an app that lets someone create an account must let
   * them delete it without leaving it. Irreversible — {@link AccountDeletionService} says what goes
   * and what stays.
   *
   * <p>Deliberately <b>not</b> under {@code /api/v1/auth/**}, which is {@code permitAll()}: the one
   * irreversible action an account can perform on itself must not sit on a path where being signed
   * in is optional.
   */
  @DeleteMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteOwnAccount(@RequestBody @Valid DeleteAccountRequest request) {
    accountDeletionService.deleteOwnAccount(TenancyContext.currentUserId(), request.password());
  }
}
