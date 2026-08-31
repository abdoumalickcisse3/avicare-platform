package com.avicare.identity.service;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.UnauthorizedException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.identity.dto.request.ChangePasswordRequest;
import com.avicare.identity.dto.request.LoginRequest;
import com.avicare.identity.dto.request.SignupRequest;
import com.avicare.identity.dto.request.UpdateProfileRequest;
import com.avicare.identity.dto.response.AuthTokens;
import com.avicare.identity.dto.response.UserResponse;
import com.avicare.identity.mapper.IdentityMapper;
import com.avicare.identity.repository.UserRepository;
import com.avicare.identity.spi.MembershipProvider;
import com.avicare.identity.spi.StaffLoginAuditor;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * End-user authentication: sign-up, login, token refresh and logout.
 *
 * <p>Access tokens carry the {@link AvicarePrincipal}. Farm memberships are resolved through the
 * {@link MembershipProvider} seam (implemented by the tenancy context), so identity never depends
 * on tenancy. The platform role defaults to {@code USER}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

  private final UserRepository userRepository;
  private final RefreshTokenService refreshTokenService;
  private final JwtService jwtService;
  private final JwtProperties jwtProperties;
  private final PasswordEncoder passwordEncoder;
  private final StaffLoginAuditor staffLoginAuditor;
  private final IdentityMapper identityMapper;
  private final MembershipProvider membershipProvider;
  private final com.avicare.identity.spi.LoginAttemptListener loginAttempts;

  /** Create + persist a USER account (shared by signup and provisioning). */
  @Transactional
  public User createUser(String fullName, String email, String phone, String rawPassword) {
    if (userRepository.existsByEmailIgnoreCase(email)) {
      throw new ConflictException("EMAIL_ALREADY_USED", "Email is already registered");
    }
    User user = new User();
    user.setEmail(email);
    user.setPasswordHash(passwordEncoder.encode(rawPassword));
    user.setFullName(fullName);
    user.setPhone(phone);
    return userRepository.save(user);
  }

  /** Register a new USER account and return an initial token pair. */
  @Transactional
  public AuthTokens signup(SignupRequest request) {
    User saved =
        createUser(request.fullName(), request.email(), request.phone(), request.password());
    log.info("New user registered: id={}", saved.getId());
    loginAttempts.accountCreated(saved.getEmail());
    return issueTokens(saved);
  }

  /** Authenticate by email + password and return a fresh token pair. */
  @Transactional
  public AuthTokens login(LoginRequest request) {
    User user =
        userRepository
            .findByEmailIgnoreCase(request.email())
            .orElseThrow(() -> failedLogin(request.email()));

    if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      throw failedLogin(request.email());
    }
    if (!user.isActive()) {
      throw new UnauthorizedException("ACCOUNT_DISABLED", "Account is disabled");
    }

    user.setLastLoginAt(LocalDateTime.now());
    log.info("User logged in: id={}", user.getId());
    if (user.getRole() == UserRole.ADMIN) {
      // Platform staff can reach every tenant, so their sign-ins belong in the back-office trail.
      staffLoginAuditor.recordStaffLogin(user.getId(), user.getEmail());
    }
    return issueTokens(user);
  }

  /** Exchange a refresh token for a new pair (single-use rotation). */
  @Transactional
  public AuthTokens refresh(String refreshToken) {
    RefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshToken);
    User user = userRepository.findById(rotation.userId()).orElseThrow(AuthService::badCredentials);
    String access = jwtService.generateAccessToken(toPrincipal(user));
    return new AuthTokens(access, rotation.refreshToken(), accessTtlSeconds());
  }

  /** Revoke a single refresh token. */
  @Transactional
  public void logout(String refreshToken) {
    refreshTokenService.revoke(refreshToken);
  }

  /** Revoke every refresh token of the given user. */
  @Transactional
  public void logoutAll(Long userId) {
    refreshTokenService.revokeAllForUser(userId);
  }

  /** Current user's profile. */
  @Transactional(readOnly = true)
  public UserResponse profile(Long userId) {
    return identityMapper.toResponse(loadUser(userId));
  }

  /** Update the editable profile fields and return the refreshed view. */
  @Transactional
  public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
    User user = loadUser(userId);
    user.setFullName(request.fullName());
    user.setPhone(request.phone());
    if (request.locale() != null && !request.locale().isBlank()) {
      user.setLocale(request.locale());
    }
    return identityMapper.toResponse(user);
  }

  /**
   * Change your own password, proving you know the current one.
   *
   * <p>Every session is revoked, this one included: the point of changing a password is usually
   * that someone else may know the old one, and leaving their session alive would defeat it. The
   * caller signs in again — the same contract as the WhatsApp reset.
   *
   * @throws com.avicare.common.api.exception.ValidationException if the current password is wrong
   *     or the new one repeats it
   */
  @Transactional
  public void changePassword(Long userId, ChangePasswordRequest request) {
    User user = loadUser(userId);
    if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
      throw new ValidationException(
          "PASSWORD_CURRENT_INVALID", "Le mot de passe actuel est incorrect.");
    }
    if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
      throw new ValidationException(
          "PASSWORD_UNCHANGED", "Le nouveau mot de passe doit être différent de l'actuel.");
    }
    user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
    userRepository.save(user);
    refreshTokenService.revokeAllForUser(userId);
    log.info("Password changed by user {}", userId);
  }

  private AuthTokens issueTokens(User user) {
    String access = jwtService.generateAccessToken(toPrincipal(user));
    String refresh = refreshTokenService.issue(user.getId());
    return new AuthTokens(access, refresh, accessTtlSeconds());
  }

  private AvicarePrincipal toPrincipal(User user) {
    return new AvicarePrincipal(
        user.getId(),
        user.getEmail(),
        user.getRole(),
        membershipProvider.membershipsFor(user.getId()));
  }

  private User loadUser(Long userId) {
    return userRepository.findById(userId).orElseThrow(() -> NotFoundException.of("User", userId));
  }

  private long accessTtlSeconds() {
    return jwtProperties.accessTokenTtl().toSeconds();
  }

  private static UnauthorizedException badCredentials() {
    return new UnauthorizedException("BAD_CREDENTIALS", "Invalid email or password");
  }

  /**
   * Tells the threat detector before refusing, so both failure paths — no such account, and wrong
   * password — count the same. They look identical from outside on purpose, and a detector that saw
   * only one of them would be blind to exactly the half a script spends most of its time in.
   */
  private UnauthorizedException failedLogin(String email) {
    loginAttempts.loginFailed(email);
    return badCredentials();
  }
}
