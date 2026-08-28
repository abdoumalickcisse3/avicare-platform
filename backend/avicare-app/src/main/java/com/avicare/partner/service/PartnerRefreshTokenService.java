package com.avicare.partner.service;

import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.partner.domain.PartnerRefreshToken;
import com.avicare.partner.exception.PartnerAuthException;
import com.avicare.partner.repository.PartnerRefreshTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Partner-portal refresh-token store: issue, rotate (revoke + reissue), revoke.
 *
 * <p>Only the SHA-256 hash of each token is stored — never the raw value — mirroring {@code
 * RefreshTokenService} on the farmer side. Two reasons, and both bite: a DB leak must not hand out
 * usable long-lived tokens, and the digest is 64 characters so it fits {@code
 * partner_refresh_tokens.token VARCHAR(500)} whatever the JWT grows to. Storing the raw token made
 * every partner login fail with "value too long for type character varying(500)", because a signed
 * RS256 partner refresh token is ~550 characters.
 */
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
    String raw = jwtService.generatePartnerRefreshToken(partnerUserId);
    PartnerRefreshToken row = new PartnerRefreshToken();
    row.setPartnerUserId(partnerUserId);
    row.setToken(hash(raw));
    row.setExpiresAt(LocalDateTime.now().plus(props.refreshTokenTtl()));
    repository.save(row);
    return raw;
  }

  @Transactional
  public Rotation rotate(String token) {
    PartnerRefreshToken row =
        repository
            .findByToken(hash(token))
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
        .findByToken(hash(token))
        .ifPresent(
            row -> {
              row.setRevokedAt(LocalDateTime.now());
              repository.save(row);
            });
  }

  /**
   * Revoke every session of a partner account. Without it, disabling an account would leave the
   * person signed in until their refresh token expires — the exact window that matters when a
   * salesperson leaves a feed supplier.
   */
  @Transactional
  public void revokeAllForPartnerUser(Long partnerUserId) {
    LocalDateTime now = LocalDateTime.now();
    for (PartnerRefreshToken row :
        repository.findByPartnerUserIdAndRevokedAtIsNull(partnerUserId)) {
      row.setRevokedAt(now);
      repository.save(row);
    }
  }

  /** SHA-256 hex digest — the only form of a refresh token that ever reaches the database. */
  private static String hash(String raw) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("SHA-256 not available", e);
    }
  }
}
