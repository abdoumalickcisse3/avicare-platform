package com.avicare.identity.service;

import com.avicare.common.api.exception.UnauthorizedException;
import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.identity.domain.RefreshToken;
import com.avicare.identity.repository.RefreshTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owns the lifecycle of refresh tokens: the database (table {@code refresh_tokens}) is the source
 * of truth for validity and revocation. Only the SHA-256 hash of each token is stored — never the
 * raw value — so a DB leak does not expose usable tokens, and the digest fits the {@code
 * VARCHAR(500)} column regardless of JWT length.
 *
 * <p>Rotation: every successful {@link #rotate} revokes the presented token and issues a fresh one,
 * so a refresh token is single-use. A Redis cache of revocations (doc 05 §10.1) is deferred to a
 * later optimization PR; correctness here is fully handled in the DB.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

  private final RefreshTokenRepository refreshTokenRepository;
  private final JwtService jwtService;
  private final JwtProperties jwtProperties;

  /**
   * Mint a refresh token for the user and persist its hash. Returns the raw token for the client.
   */
  @Transactional
  public String issue(Long userId) {
    String raw = jwtService.generateRefreshToken(userId);
    RefreshToken entity = new RefreshToken();
    entity.setUserId(userId);
    entity.setToken(hash(raw));
    entity.setExpiresAt(LocalDateTime.now().plus(jwtProperties.refreshTokenTtl()));
    refreshTokenRepository.save(entity);
    return raw;
  }

  /**
   * Validate a presented refresh token (RSA signature + DB record present, not revoked, not
   * expired), revoke it, and issue a new one. Single-use rotation.
   *
   * @return the new raw refresh token and the owning user id
   * @throws UnauthorizedException if the token is invalid, unknown, revoked or expired
   */
  @Transactional
  public Rotation rotate(String rawToken) {
    Long userId = verifySignature(rawToken);
    RefreshToken stored =
        refreshTokenRepository
            .findByToken(hash(rawToken))
            .orElseThrow(() -> invalid("Refresh token not recognized"));

    if (stored.getRevokedAt() != null) {
      throw invalid("Refresh token has been revoked");
    }
    if (stored.getExpiresAt().isBefore(LocalDateTime.now())) {
      throw invalid("Refresh token has expired");
    }

    stored.setRevokedAt(LocalDateTime.now());
    refreshTokenRepository.save(stored);

    String newRaw = issue(userId);
    return new Rotation(newRaw, userId);
  }

  /** Revoke a single token (logout). Unknown/invalid tokens are ignored (idempotent). */
  @Transactional
  public void revoke(String rawToken) {
    refreshTokenRepository
        .findByToken(hash(rawToken))
        .ifPresent(
            t -> {
              if (t.getRevokedAt() == null) {
                t.setRevokedAt(LocalDateTime.now());
                refreshTokenRepository.save(t);
              }
            });
  }

  /** Revoke every active token of a user (logout-all / password change). */
  @Transactional
  public void revokeAllForUser(Long userId) {
    LocalDateTime now = LocalDateTime.now();
    refreshTokenRepository.findByUserIdAndRevokedAtIsNull(userId).forEach(t -> t.setRevokedAt(now));
  }

  private Long verifySignature(String rawToken) {
    try {
      return jwtService.validateRefreshToken(rawToken);
    } catch (RuntimeException e) {
      throw invalid("Invalid refresh token");
    }
  }

  private static UnauthorizedException invalid(String message) {
    return new UnauthorizedException("INVALID_REFRESH_TOKEN", message);
  }

  private static String hash(String raw) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] out = digest.digest(raw.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(out);
    } catch (Exception e) {
      throw new IllegalStateException("SHA-256 not available", e);
    }
  }

  /** Result of a rotation: the new raw refresh token and the user it belongs to. */
  public record Rotation(String refreshToken, Long userId) {}
}
