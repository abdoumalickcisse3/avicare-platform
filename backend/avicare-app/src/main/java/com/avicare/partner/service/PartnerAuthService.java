package com.avicare.partner.service;

import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.PartnerPrincipal;
import com.avicare.partner.domain.PartnerUser;
import com.avicare.partner.dto.request.PartnerLoginRequest;
import com.avicare.partner.dto.response.PartnerAuthTokens;
import com.avicare.partner.exception.PartnerAuthException;
import com.avicare.partner.repository.PartnerUserRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Partner-portal authentication: login, refresh rotation, logout. Cloisonned from farmer auth. */
@Service
@RequiredArgsConstructor
public class PartnerAuthService {

  private final PartnerUserRepository partnerUserRepository;
  private final JwtService jwtService;
  private final PartnerRefreshTokenService refreshTokenService;
  private final PasswordEncoder passwordEncoder;
  private final JwtProperties props;

  @Transactional
  public PartnerAuthTokens login(PartnerLoginRequest request) {
    PartnerUser user =
        partnerUserRepository
            .findByEmail(request.email())
            .orElseThrow(() -> new PartnerAuthException("Invalid credentials"));
    if (!user.isActive() || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      throw new PartnerAuthException("Invalid credentials");
    }
    // The only signal that says whether a signed partner actually uses the portal.
    user.setLastLoginAt(LocalDateTime.now());
    return issue(user);
  }

  @Transactional
  public PartnerAuthTokens refresh(String refreshToken) {
    PartnerRefreshTokenService.Rotation rotation = refreshTokenService.rotate(refreshToken);
    PartnerUser user =
        partnerUserRepository
            .findById(rotation.partnerUserId())
            .orElseThrow(() -> new PartnerAuthException("Unknown partner user"));
    String access =
        jwtService.generatePartnerAccessToken(
            new PartnerPrincipal(user.getId(), user.getEmail(), user.getPartnerId()));
    return new PartnerAuthTokens(access, rotation.refreshToken(), accessTtlSeconds());
  }

  @Transactional
  public void logout(String refreshToken) {
    refreshTokenService.revoke(refreshToken);
  }

  private PartnerAuthTokens issue(PartnerUser user) {
    String access =
        jwtService.generatePartnerAccessToken(
            new PartnerPrincipal(user.getId(), user.getEmail(), user.getPartnerId()));
    String refresh = refreshTokenService.issue(user.getId());
    return new PartnerAuthTokens(access, refresh, accessTtlSeconds());
  }

  private long accessTtlSeconds() {
    return props.accessTokenTtl().toSeconds();
  }
}
