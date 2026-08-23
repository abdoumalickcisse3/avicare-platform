package com.avicare.common.security.jwt;

import com.avicare.common.security.exception.ExpiredTokenException;
import com.avicare.common.security.exception.InvalidTokenException;
import com.avicare.common.security.exception.WrongTokenTypeException;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.Membership;
import com.avicare.common.security.principal.PartnerPrincipal;
import com.avicare.common.security.principal.UserRole;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import jakarta.annotation.PostConstruct;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Generates and validates the platform's RSA-signed JWTs.
 *
 * <p>Access tokens are short-lived and carry the full {@link AvicarePrincipal} payload so
 * downstream services don't need a DB hit to authorize a call. Refresh tokens are long-lived but
 * carry only the user id — they can only be exchanged at the auth endpoint.
 *
 * <p>If JWT key material is not configured at startup the service logs a warning and stays inert:
 * any subsequent call to a generation or validation method throws {@link IllegalStateException}.
 * This lets the application boot before keys are provisioned (Sprint A3) without crashing.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JwtService {

  private static final String CLAIM_EMAIL = "email";
  private static final String CLAIM_ROLE = "role";
  private static final String CLAIM_MEMBERSHIPS = "memberships";
  private static final String CLAIM_TYPE = "type";
  private static final String CLAIM_PARTNER_ID = "partner_id";
  private static final String TYPE_ACCESS = "access";
  private static final String TYPE_REFRESH = "refresh";
  private static final String TYPE_PARTNER_ACCESS = "partner_access";
  private static final String TYPE_PARTNER_REFRESH = "partner_refresh";

  private final JwtProperties props;
  private final KeyLoader keyLoader;
  private final ObjectMapper objectMapper;

  private RSAPrivateKey privateKey;
  private RSAPublicKey publicKey;

  /**
   * Loads the key pair once at startup. A failure here is logged and swallowed so the application
   * can still boot in environments where keys are not provisioned yet; any later call to a
   * generation or validation method will fail loudly via {@link #requireKeys()}.
   */
  @PostConstruct
  void init() {
    try {
      this.privateKey = keyLoader.loadPrivateKey();
      this.publicKey = keyLoader.loadPublicKey();
      log.info("JWT keys loaded successfully (RSA 2048)");
    } catch (RuntimeException e) {
      log.warn(
          "JWT keys not configured; JwtService is inert until keys are provided. Cause: {}",
          e.getMessage());
    }
  }

  /** Generate a short-lived access token carrying the principal's email, role and memberships. */
  public String generateAccessToken(AvicarePrincipal principal) {
    requireKeys();
    Instant now = Instant.now();
    Instant exp = now.plus(props.accessTokenTtl());

    return Jwts.builder()
        .issuer(props.issuer())
        .subject(principal.userId().toString())
        .id(UUID.randomUUID().toString())
        .issuedAt(Date.from(now))
        .expiration(Date.from(exp))
        .claims(
            Map.of(
                CLAIM_EMAIL, principal.email(),
                CLAIM_ROLE, principal.role(),
                CLAIM_MEMBERSHIPS, principal.memberships(),
                CLAIM_TYPE, TYPE_ACCESS))
        .signWith(privateKey, Jwts.SIG.RS256)
        .compact();
  }

  /** Generate a long-lived refresh token carrying only the user id. */
  public String generateRefreshToken(Long userId) {
    requireKeys();
    Instant now = Instant.now();
    Instant exp = now.plus(props.refreshTokenTtl());

    return Jwts.builder()
        .issuer(props.issuer())
        .subject(userId.toString())
        .id(UUID.randomUUID().toString())
        .issuedAt(Date.from(now))
        .expiration(Date.from(exp))
        .claims(Map.of(CLAIM_TYPE, TYPE_REFRESH))
        .signWith(privateKey, Jwts.SIG.RS256)
        .compact();
  }

  /**
   * Verify an access token (signature, issuer, expiration, type) and rebuild the principal from its
   * claims.
   *
   * @throws InvalidTokenException if the token is malformed or fails the signature check
   * @throws ExpiredTokenException if the token has expired
   * @throws WrongTokenTypeException if the token is a refresh token
   */
  public AvicarePrincipal validateAccessToken(String token) {
    Claims claims = parseClaims(token);
    requireType(claims, TYPE_ACCESS);

    try {
      Long userId = Long.parseLong(claims.getSubject());
      String email = claims.get(CLAIM_EMAIL, String.class);
      UserRole role = UserRole.valueOf(claims.get(CLAIM_ROLE, String.class));
      List<Membership> memberships =
          objectMapper.convertValue(
              claims.get(CLAIM_MEMBERSHIPS), new TypeReference<List<Membership>>() {});
      return new AvicarePrincipal(userId, email, role, memberships);
    } catch (IllegalArgumentException | NullPointerException e) {
      throw new InvalidTokenException("Cannot reconstruct principal: " + e.getMessage(), e);
    }
  }

  /**
   * Verify a refresh token (signature, issuer, expiration, type) and return the user id.
   *
   * @throws InvalidTokenException if the token is malformed or fails the signature check
   * @throws ExpiredTokenException if the token has expired
   * @throws WrongTokenTypeException if the token is an access token
   */
  public Long validateRefreshToken(String token) {
    Claims claims = parseClaims(token);
    requireType(claims, TYPE_REFRESH);
    return Long.parseLong(claims.getSubject());
  }

  /** Generate a partner-portal access token (audience distinct from farmer tokens). */
  public String generatePartnerAccessToken(PartnerPrincipal principal) {
    requireKeys();
    Instant now = Instant.now();
    return Jwts.builder()
        .issuer(props.issuer())
        .subject(principal.partnerUserId().toString())
        .id(UUID.randomUUID().toString())
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plus(props.accessTokenTtl())))
        .claims(
            Map.of(
                CLAIM_EMAIL, principal.email(),
                CLAIM_PARTNER_ID, principal.partnerId(),
                CLAIM_TYPE, TYPE_PARTNER_ACCESS))
        .signWith(privateKey, Jwts.SIG.RS256)
        .compact();
  }

  /** Generate a partner-portal refresh token carrying only the partner-user id. */
  public String generatePartnerRefreshToken(Long partnerUserId) {
    requireKeys();
    Instant now = Instant.now();
    return Jwts.builder()
        .issuer(props.issuer())
        .subject(partnerUserId.toString())
        .id(UUID.randomUUID().toString())
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plus(props.refreshTokenTtl())))
        .claims(Map.of(CLAIM_TYPE, TYPE_PARTNER_REFRESH))
        .signWith(privateKey, Jwts.SIG.RS256)
        .compact();
  }

  /**
   * Verify a partner access token and rebuild the {@link PartnerPrincipal}. Throws {@link
   * WrongTokenTypeException} for a farmer/refresh token — the cloisonnement guarantee.
   */
  public PartnerPrincipal validatePartnerAccessToken(String token) {
    Claims claims = parseClaims(token);
    requireType(claims, TYPE_PARTNER_ACCESS);
    try {
      Long partnerUserId = Long.parseLong(claims.getSubject());
      String email = claims.get(CLAIM_EMAIL, String.class);
      Long partnerId = claims.get(CLAIM_PARTNER_ID, Number.class).longValue();
      return new PartnerPrincipal(partnerUserId, email, partnerId);
    } catch (IllegalArgumentException | NullPointerException e) {
      throw new InvalidTokenException("Cannot reconstruct partner principal: " + e.getMessage(), e);
    }
  }

  /** Verify a partner refresh token and return the partner-user id. */
  public Long validatePartnerRefreshToken(String token) {
    Claims claims = parseClaims(token);
    requireType(claims, TYPE_PARTNER_REFRESH);
    return Long.parseLong(claims.getSubject());
  }

  private Claims parseClaims(String token) {
    requireKeys();
    try {
      return Jwts.parser()
          .verifyWith(publicKey)
          .requireIssuer(props.issuer())
          .build()
          .parseSignedClaims(token)
          .getPayload();
    } catch (ExpiredJwtException e) {
      throw new ExpiredTokenException(e);
    } catch (JwtException | IllegalArgumentException e) {
      throw new InvalidTokenException(e.getMessage(), e);
    }
  }

  private void requireType(Claims claims, String expected) {
    String actual = claims.get(CLAIM_TYPE, String.class);
    if (!expected.equals(actual)) {
      throw new WrongTokenTypeException(expected, String.valueOf(actual));
    }
  }

  private void requireKeys() {
    if (privateKey == null || publicKey == null) {
      throw new IllegalStateException(
          "JwtService is not initialized: configure 'avicare.security.jwt.*' RSA keys.");
    }
  }
}
