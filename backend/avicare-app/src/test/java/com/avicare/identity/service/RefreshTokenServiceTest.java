package com.avicare.identity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.UnauthorizedException;
import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.identity.domain.RefreshToken;
import com.avicare.identity.repository.RefreshTokenRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for {@link RefreshTokenService}: repositories and JWT service mocked. */
class RefreshTokenServiceTest {

  private RefreshTokenRepository repository;
  private JwtService jwtService;
  private RefreshTokenService service;

  @BeforeEach
  void setUp() {
    repository = Mockito.mock(RefreshTokenRepository.class);
    jwtService = Mockito.mock(JwtService.class);
    JwtProperties props =
        new JwtProperties(
            "avicare", Duration.ofMinutes(15), Duration.ofDays(30), null, null, null, null);
    service = new RefreshTokenService(repository, jwtService, props);
    when(repository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
  }

  private RefreshToken stored(Long userId, LocalDateTime revokedAt, LocalDateTime expiresAt) {
    RefreshToken t = new RefreshToken();
    t.setUserId(userId);
    t.setRevokedAt(revokedAt);
    t.setExpiresAt(expiresAt);
    return t;
  }

  @Test
  void rotate_validToken_revokesOldAndIssuesNew() {
    when(jwtService.validateRefreshToken(anyString())).thenReturn(7L);
    when(jwtService.generateRefreshToken(7L)).thenReturn("new-raw-token");
    RefreshToken current = stored(7L, null, LocalDateTime.now().plusDays(30));
    when(repository.findByToken(anyString())).thenReturn(Optional.of(current));

    RefreshTokenService.Rotation rotation = service.rotate("old-raw-token");

    assertThat(rotation.refreshToken()).isEqualTo("new-raw-token");
    assertThat(rotation.userId()).isEqualTo(7L);
    assertThat(current.getRevokedAt()).isNotNull(); // presented token revoked (single-use)
    verify(repository, never()).findByUserIdAndRevokedAtIsNull(any());
  }

  @Test
  void rotate_replayOfRevokedToken_revokesWholeFamilyAndThrows() {
    when(jwtService.validateRefreshToken(anyString())).thenReturn(7L);
    RefreshToken alreadyRotated =
        stored(7L, LocalDateTime.now().minusMinutes(1), LocalDateTime.now().plusDays(30));
    when(repository.findByToken(anyString())).thenReturn(Optional.of(alreadyRotated));
    RefreshToken victimActive = stored(7L, null, LocalDateTime.now().plusDays(30));
    when(repository.findByUserIdAndRevokedAtIsNull(7L)).thenReturn(List.of(victimActive));

    assertThatThrownBy(() -> service.rotate("replayed-token"))
        .isInstanceOf(UnauthorizedException.class);

    // Reuse detection nuked the family: the victim's still-active token is now revoked.
    verify(repository).findByUserIdAndRevokedAtIsNull(7L);
    assertThat(victimActive.getRevokedAt()).isNotNull();
  }

  @Test
  void rotate_expiredToken_throws() {
    when(jwtService.validateRefreshToken(anyString())).thenReturn(7L);
    RefreshToken expired = stored(7L, null, LocalDateTime.now().minusDays(1));
    when(repository.findByToken(anyString())).thenReturn(Optional.of(expired));

    assertThatThrownBy(() -> service.rotate("expired-token"))
        .isInstanceOf(UnauthorizedException.class);
    verify(repository, never()).findByUserIdAndRevokedAtIsNull(any());
  }

  @Test
  void purgeExpired_delegatesToRepository() {
    when(repository.deleteExpiredBefore(any(LocalDateTime.class))).thenReturn(3);

    service.purgeExpired();

    verify(repository).deleteExpiredBefore(any(LocalDateTime.class));
  }
}
