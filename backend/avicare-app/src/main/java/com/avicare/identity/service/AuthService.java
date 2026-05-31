package com.avicare.identity.service;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.UnauthorizedException;
import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.identity.domain.User;
import com.avicare.identity.dto.request.LoginRequest;
import com.avicare.identity.dto.request.SignupRequest;
import com.avicare.identity.dto.request.UpdateProfileRequest;
import com.avicare.identity.dto.response.AuthTokens;
import com.avicare.identity.dto.response.UserResponse;
import com.avicare.identity.mapper.IdentityMapper;
import com.avicare.identity.repository.UserRepository;
import com.avicare.identity.spi.MembershipProvider;
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
  private final IdentityMapper identityMapper;
  private final MembershipProvider membershipProvider;

  /** Register a new USER account and return an initial token pair. */
  @Transactional
  public AuthTokens signup(SignupRequest request) {
    if (userRepository.existsByEmailIgnoreCase(request.email())) {
      throw new ConflictException("EMAIL_ALREADY_USED", "Email is already registered");
    }

    User user = new User();
    user.setEmail(request.email());
    user.setPasswordHash(passwordEncoder.encode(request.password()));
    user.setFullName(request.fullName());
    user.setPhone(request.phone());
    User saved = userRepository.save(user);

    log.info("New user registered: id={}", saved.getId());
    return issueTokens(saved);
  }

  /** Authenticate by email + password and return a fresh token pair. */
  @Transactional
  public AuthTokens login(LoginRequest request) {
    User user =
        userRepository
            .findByEmailIgnoreCase(request.email())
            .orElseThrow(AuthService::badCredentials);

    if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      throw badCredentials();
    }
    if (!user.isActive()) {
      throw new UnauthorizedException("ACCOUNT_DISABLED", "Account is disabled");
    }

    user.setLastLoginAt(LocalDateTime.now());
    log.info("User logged in: id={}", user.getId());
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
}
