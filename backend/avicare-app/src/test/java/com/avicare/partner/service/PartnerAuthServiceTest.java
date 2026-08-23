package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.partner.domain.PartnerUser;
import com.avicare.partner.dto.request.PartnerLoginRequest;
import com.avicare.partner.exception.PartnerAuthException;
import com.avicare.partner.repository.PartnerUserRepository;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class PartnerAuthServiceTest {

  @Mock PartnerUserRepository partnerUserRepository;
  @Mock JwtService jwtService;
  @Mock PartnerRefreshTokenService refreshTokenService;
  @Mock JwtProperties props;
  final PasswordEncoder encoder = new BCryptPasswordEncoder(12);

  PartnerAuthService service() {
    return new PartnerAuthService(
        partnerUserRepository, jwtService, refreshTokenService, encoder, props);
  }

  private PartnerUser activeUser() {
    PartnerUser u = new PartnerUser();
    u.setEmail("p@x.io");
    u.setPartnerId(3L);
    u.setActive(true);
    u.setPasswordHash(encoder.encode("secret"));
    return u;
  }

  @Test
  void loginRejectsWrongPassword() {
    when(partnerUserRepository.findByEmail("p@x.io")).thenReturn(Optional.of(activeUser()));
    assertThatThrownBy(() -> service().login(new PartnerLoginRequest("p@x.io", "WRONG")))
        .isInstanceOf(PartnerAuthException.class);
  }

  @Test
  void loginRejectsInactiveAccount() {
    PartnerUser u = activeUser();
    u.setActive(false);
    when(partnerUserRepository.findByEmail("p@x.io")).thenReturn(Optional.of(u));
    assertThatThrownBy(() -> service().login(new PartnerLoginRequest("p@x.io", "secret")))
        .isInstanceOf(PartnerAuthException.class);
  }

  @Test
  void loginRejectsUnknownEmail() {
    when(partnerUserRepository.findByEmail("nobody@x.io")).thenReturn(Optional.empty());
    assertThatThrownBy(() -> service().login(new PartnerLoginRequest("nobody@x.io", "secret")))
        .isInstanceOf(PartnerAuthException.class);
  }

  @Test
  void loginIssuesTokensOnValidCredentials() {
    when(partnerUserRepository.findByEmail("p@x.io")).thenReturn(Optional.of(activeUser()));
    when(jwtService.generatePartnerAccessToken(any())).thenReturn("acc");
    when(refreshTokenService.issue(any())).thenReturn("ref");
    when(props.accessTokenTtl()).thenReturn(Duration.ofMinutes(15));

    var tokens = service().login(new PartnerLoginRequest("p@x.io", "secret"));

    assertThat(tokens.accessToken()).isEqualTo("acc");
    assertThat(tokens.refreshToken()).isEqualTo("ref");
    assertThat(tokens.expiresIn()).isEqualTo(900);
  }
}
