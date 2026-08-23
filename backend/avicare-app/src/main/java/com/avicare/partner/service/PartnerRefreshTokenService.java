package com.avicare.partner.service;

import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.partner.domain.PartnerRefreshToken;
import com.avicare.partner.exception.PartnerAuthException;
import com.avicare.partner.repository.PartnerRefreshTokenRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Partner-portal refresh-token store: issue, rotate (revoke + reissue), revoke. */
@Service
@RequiredArgsConstructor
public class PartnerRefreshTokenService {

  /** Result of a rotation: the owning partner-user and the freshly issued token. */
  public record Rotation(Long partnerUserId, String refreshToken) {}

  private final PartnerRefreshTokenRepository repository;
  private final JwtService jwtService;
  private final JwtProperties props;

  @Transactional
  public String issue(Long partnerUserId) {
    String token = jwtService.generatePartnerRefreshToken(partnerUserId);
    PartnerRefreshToken row = new PartnerRefreshToken();
    row.setPartnerUserId(partnerUserId);
    row.setToken(token);
    row.setExpiresAt(LocalDateTime.now().plus(props.refreshTokenTtl()));
    repository.save(row);
    return token;
  }

  @Transactional
  public Rotation rotate(String token) {
    PartnerRefreshToken row =
        repository
            .findByToken(token)
            .orElseThrow(() -> new PartnerAuthException("Unknown refresh token"));
    if (row.getRevokedAt() != null || row.getExpiresAt().isBefore(LocalDateTime.now())) {
      throw new PartnerAuthException("Refresh token is revoked or expired");
    }
    row.setRevokedAt(LocalDateTime.now());
    repository.save(row);
    Long partnerUserId = jwtService.validatePartnerRefreshToken(token);
    return new Rotation(partnerUserId, issue(partnerUserId));
  }

  @Transactional
  public void revoke(String token) {
    repository
        .findByToken(token)
        .ifPresent(
            row -> {
              row.setRevokedAt(LocalDateTime.now());
              repository.save(row);
            });
  }
}
