package com.avicare.identity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.UnauthorizedException;
import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.jwt.KeyLoader;
import com.avicare.identity.domain.User;
import com.avicare.identity.dto.request.LoginRequest;
import com.avicare.identity.dto.request.SignupRequest;
import com.avicare.identity.dto.response.AuthTokens;
import com.avicare.identity.mapper.IdentityMapper;
import com.avicare.identity.repository.UserRepository;
import com.avicare.identity.spi.MembershipProvider;
import com.avicare.support.RsaKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.mockito.Mockito;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Pure unit test for {@link AuthService}: repositories and {@link RefreshTokenService} are mocked,
 * while a real {@link BCryptPasswordEncoder} and a real {@link JwtService} (in-memory RSA keys) are
 * used so the password and token paths are genuinely exercised — no database, no Spring context.
 */
class AuthServiceTest {

  private static final PasswordEncoder ENCODER = new BCryptPasswordEncoder(12);
  private static JwtService jwtService;
  private static JwtProperties jwtProperties;

  private UserRepository userRepository;
  private RefreshTokenService refreshTokenService;
  private AuthService authService;

  @BeforeEach
  void setUp() {
    KeyPair keys = RsaKeys.generate();
    jwtProperties =
        new JwtProperties(
            "avicare-test",
            Duration.ofMinutes(15),
            Duration.ofDays(7),
            null,
            null,
            RsaKeys.privatePem(keys),
            RsaKeys.publicPem(keys));
    jwtService =
        new JwtService(
            jwtProperties,
            new KeyLoader(new DefaultResourceLoader(), jwtProperties),
            new ObjectMapper());
    // init() is package-private in common-security; invoke reflectively to load the keys.
    ReflectionTestUtils.invokeMethod(jwtService, "init");

    userRepository = Mockito.mock(UserRepository.class);
    refreshTokenService = Mockito.mock(RefreshTokenService.class);
    IdentityMapper mapper = Mappers.getMapper(IdentityMapper.class);
    // No-membership provider: A3-2 token-shape behavior is unchanged by tenancy.
    MembershipProvider membershipProvider = userId -> java.util.List.of();
    // No admin context in this slice: staff sign-ins have nowhere to be traced, which is the
    // no-op seam's whole purpose.
    com.avicare.identity.spi.StaffLoginAuditor staffLoginAuditor = (userId, email) -> {};
    authService =
        new AuthService(
            userRepository,
            refreshTokenService,
            jwtService,
            jwtProperties,
            ENCODER,
            staffLoginAuditor,
            mapper,
            membershipProvider);
  }

  @Test
  void signup_persistsHashedPassword_andReturnsTokens() {
    when(userRepository.existsByEmailIgnoreCase("awa@avicare.io")).thenReturn(false);
    when(userRepository.save(any(User.class)))
        .thenAnswer(
            inv -> {
              User u = inv.getArgument(0);
              u.setId(1L);
              return u;
            });
    when(refreshTokenService.issue(1L)).thenReturn("refresh-raw");

    AuthTokens tokens =
        authService.signup(new SignupRequest("awa@avicare.io", "password123", "Awa Diop", null));

    assertThat(tokens.accessToken()).isNotBlank();
    assertThat(tokens.refreshToken()).isEqualTo("refresh-raw");
    assertThat(tokens.expiresIn()).isEqualTo(900L);

    // The reconstructed principal proves the token is valid and carries the user identity.
    assertThat(jwtService.validateAccessToken(tokens.accessToken()).userId()).isEqualTo(1L);
  }

  @Test
  void signup_duplicateEmail_throwsConflict() {
    when(userRepository.existsByEmailIgnoreCase("dup@avicare.io")).thenReturn(true);

    assertThatThrownBy(
            () ->
                authService.signup(new SignupRequest("dup@avicare.io", "password123", "Dup", null)))
        .isInstanceOf(ConflictException.class);

    verify(userRepository, never()).save(any());
  }

  @Test
  void login_wrongPassword_throwsUnauthorized() {
    User user = existingUser("bob@avicare.io", "rightpass");
    when(userRepository.findByEmailIgnoreCase("bob@avicare.io")).thenReturn(Optional.of(user));

    assertThatThrownBy(() -> authService.login(new LoginRequest("bob@avicare.io", "wrongpass")))
        .isInstanceOf(UnauthorizedException.class);
  }

  @Test
  void login_unknownEmail_throwsUnauthorized() {
    when(userRepository.findByEmailIgnoreCase(any())).thenReturn(Optional.empty());

    assertThatThrownBy(() -> authService.login(new LoginRequest("ghost@avicare.io", "whatever")))
        .isInstanceOf(UnauthorizedException.class);
  }

  @Test
  void login_validCredentials_returnsTokens() {
    User user = existingUser("ok@avicare.io", "correcthorse");
    when(userRepository.findByEmailIgnoreCase("ok@avicare.io")).thenReturn(Optional.of(user));
    when(refreshTokenService.issue(7L)).thenReturn("refresh-raw");

    AuthTokens tokens = authService.login(new LoginRequest("ok@avicare.io", "correcthorse"));

    assertThat(tokens.accessToken()).isNotBlank();
    assertThat(jwtService.validateAccessToken(tokens.accessToken()).userId()).isEqualTo(7L);
  }

  @Test
  void logout_delegatesRevocation() {
    authService.logout("some-refresh");
    verify(refreshTokenService).revoke("some-refresh");
  }

  @Test
  void logoutAll_delegatesRevocation() {
    authService.logoutAll(7L);
    verify(refreshTokenService).revokeAllForUser(7L);
  }

  private User existingUser(String email, String rawPassword) {
    User user = new User();
    user.setId(7L);
    user.setEmail(email);
    user.setPasswordHash(ENCODER.encode(rawPassword));
    user.setFullName("Test User");
    return user;
  }
}
