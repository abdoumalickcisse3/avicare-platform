package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.partner.domain.PartnerRefreshToken;
import com.avicare.partner.exception.PartnerAuthException;
import com.avicare.partner.repository.PartnerRefreshTokenRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * The column {@code partner_refresh_tokens.token} is a VARCHAR(500) and a signed RS256 partner
 * refresh token is ~550 characters, so storing the raw value made every partner login fail with
 * "value too long for type character varying(500)". These tests pin the fix: only the digest is
 * ever persisted.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PartnerRefreshTokenServiceTest {

  private static final Long PARTNER_USER_ID = 5L;

  /** A stand-in the length of a real signed partner refresh token. */
  private static final String RAW_TOKEN = "e".repeat(550);

  @Mock PartnerRefreshTokenRepository repository;
  @Mock JwtService jwtService;

  private PartnerRefreshTokenService service() {
    JwtProperties props =
        new JwtProperties(
            "avicare", Duration.ofMinutes(15), Duration.ofDays(30), null, null, null, null);
    return new PartnerRefreshTokenService(repository, jwtService, props);
  }

  private String storedTokenOf() {
    ArgumentCaptor<PartnerRefreshToken> saved = ArgumentCaptor.captor();
    verify(repository).save(saved.capture());
    return saved.getValue().getToken();
  }

  @Test
  void persistsTheDigestAndReturnsTheRawTokenToTheClient() {
    when(jwtService.generatePartnerRefreshToken(PARTNER_USER_ID)).thenReturn(RAW_TOKEN);

    String returned = service().issue(PARTNER_USER_ID);

    // The client needs the usable token…
    assertThat(returned).isEqualTo(RAW_TOKEN);
    // …the database must never see it.
    assertThat(storedTokenOf()).isNotEqualTo(RAW_TOKEN);
  }

  @Test
  void theStoredValueFitsTheVarchar500Column() {
    when(jwtService.generatePartnerRefreshToken(PARTNER_USER_ID)).thenReturn(RAW_TOKEN);

    service().issue(PARTNER_USER_ID);

    // A SHA-256 hex digest: 64 characters, whatever the JWT grows to.
    assertThat(storedTokenOf()).hasSize(64).matches("[0-9a-f]{64}");
  }

  @Test
  void looksUpARotationByDigestNotByRawToken() {
    when(repository.findByToken(any())).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().rotate(RAW_TOKEN)).isInstanceOf(PartnerAuthException.class);

    ArgumentCaptor<String> looked = ArgumentCaptor.captor();
    verify(repository).findByToken(looked.capture());
    // Searching for the raw value would never match a stored digest.
    assertThat(looked.getValue()).isNotEqualTo(RAW_TOKEN).hasSize(64);
  }

  @Test
  void revokesByDigestToo() {
    when(repository.findByToken(any())).thenReturn(Optional.empty());

    service().revoke(RAW_TOKEN);

    ArgumentCaptor<String> looked = ArgumentCaptor.captor();
    verify(repository).findByToken(looked.capture());
    assertThat(looked.getValue()).hasSize(64);
  }

  @Test
  void refusesARevokedToken() {
    PartnerRefreshToken row = new PartnerRefreshToken();
    row.setPartnerUserId(PARTNER_USER_ID);
    row.setExpiresAt(LocalDateTime.now().plusDays(1));
    row.setRevokedAt(LocalDateTime.now().minusMinutes(1));
    when(repository.findByToken(any())).thenReturn(Optional.of(row));

    assertThatThrownBy(() -> service().rotate(RAW_TOKEN))
        .isInstanceOf(PartnerAuthException.class)
        .hasMessageContaining("revoked");
  }
}
