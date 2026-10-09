package com.avicare.identity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.UnauthorizedException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.common.security.jwt.JwtProperties;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.jwt.KeyLoader;
import com.avicare.identity.domain.User;
import com.avicare.identity.dto.request.ChangePasswordRequest;
import com.avicare.identity.dto.request.LoginRequest;
import com.avicare.identity.dto.request.SignupRequest;
import com.avicare.identity.dto.response.AuthTokens;
import com.avicare.identity.mapper.IdentityMapper;
import com.avicare.identity.repository.UserRepository;
import com.avicare.identity.spi.MembershipProvider;
import com.avicare.support.RsaKeys;
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
import tools.jackson.databind.ObjectMapper;

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
    // Same idea for sign-in outcomes: this slice has no threat detector behind it.
    com.avicare.identity.spi.LoginAttemptListener loginAttempts =
        new com.avicare.identity.spi.LoginAttemptListener() {
          @Override
          public void loginFailed(String email) {}

          @Override
          public void accountCreated(String email) {}
        };
    authService =
        new AuthService(
            userRepository,
            refreshTokenService,
            jwtService,
            jwtProperties,
            ENCODER,
            staffLoginAuditor,
            new PhoneLookup("221"),
            mapper,
            membershipProvider,
            loginAttempts);
  }

  /**
   * Login by phone, added 2026-10-08. The field on the wire is still called {@code email} on
   * purpose: an iOS build already in testers' hands sends that name, and renaming it would lock
   * them out. It carries an identifier now — an address or a number.
   */
  private User existingUser(String email, String phone, String rawPassword) {
    User u = new User();
    u.setId(7L);
    u.setEmail(email);
    u.setPhone(phone);
    u.setFullName("Awa Diop");
    u.setPasswordHash(ENCODER.encode(rawPassword));
    u.setActive(true);
    return u;
  }

  @Test
  void login_acceptsAPhoneNumberWhereverItsOwnerTypedIt() {
    User awa = existingUser("awa@avicare.io", "+221771842787", "password123");
    // Stored as E.164; typed as the owner pleases. All of these are the same person.
    when(userRepository.findByPhoneDigits(any())).thenReturn(java.util.List.of(awa));
    when(refreshTokenService.issue(7L)).thenReturn("refresh-raw");

    for (String typed :
        java.util.List.of("+221771842787", "221771842787", "771842787", "0771842787")) {
      assertThat(authService.login(new LoginRequest(typed, "password123")).accessToken())
          .as("connexion avec « %s »", typed)
          .isNotBlank();
    }
  }

  @Test
  void login_stillAcceptsAnEmail_becauseEveryAccountHasOne() {
    // Eleven of thirty live accounts carry no phone at all. The address is the universal key and
    // must never stop working.
    User awa = existingUser("awa@avicare.io", null, "password123");
    when(userRepository.findByEmailIgnoreCase("awa@avicare.io")).thenReturn(Optional.of(awa));
    when(refreshTokenService.issue(7L)).thenReturn("refresh-raw");

    assertThat(authService.login(new LoginRequest("awa@avicare.io", "password123")).accessToken())
        .isNotBlank();
    verify(userRepository, never()).findByPhoneDigits(any());
  }

  @Test
  void login_refusesAnUnknownNumber_withTheSameErrorAsAnUnknownAddress() {
    // Never reveal whether the number exists: a phone number is public, a password is not.
    when(userRepository.findByPhoneDigits(any())).thenReturn(java.util.List.of());

    assertThatThrownBy(() -> authService.login(new LoginRequest("771842787", "password123")))
        .isInstanceOf(UnauthorizedException.class);
  }

  @Test
  void login_refusesWhenANumberDesignatesSeveralAccounts() {
    // A unique index makes this impossible going forward, but the code must not pick one at
    // random if it ever happens: guessing which account someone meant is worse than refusing.
    User one = existingUser("a@avicare.io", "+221771842787", "password123");
    User two = existingUser("b@avicare.io", "+221771842787", "password123");
    when(userRepository.findByPhoneDigits(any())).thenReturn(java.util.List.of(one, two));

    assertThatThrownBy(() -> authService.login(new LoginRequest("771842787", "password123")))
        .isInstanceOf(UnauthorizedException.class);
  }

  /**
   * V64 made the number unique in the database. Without a check in the service the index is still
   * enforced — by PostgreSQL, as a raw integrity violation that the error handler has no mapping
   * for and turns into a 500. These two tests are the difference between a sentence and a crash.
   */
  @Test
  void signup_refusesANumberAnotherAccountAlreadyHolds() {
    when(userRepository.existsByEmailIgnoreCase("bintou@avicare.io")).thenReturn(false);
    User awa = existingUser("awa@avicare.io", "+221771842787", "password123");
    when(userRepository.findByPhoneDigits(any())).thenReturn(java.util.List.of(awa));

    assertThatThrownBy(
            () ->
                authService.signup(
                    new SignupRequest(
                        "bintou@avicare.io", "password123", "Bintou Fall", "771842787")))
        .isInstanceOf(ConflictException.class)
        .hasMessageContaining("déjà associé");
    verify(userRepository, never()).save(any(User.class));
  }

  @Test
  void updateProfile_letsSomeoneKeepTheirOwnNumber() {
    // The collision check must not fire on the only account that legitimately holds the number:
    // its owner, saving their profile without touching the field.
    User awa = existingUser("awa@avicare.io", "+221771842787", "password123");
    when(userRepository.findById(7L)).thenReturn(Optional.of(awa));
    when(userRepository.findByPhoneDigits(any())).thenReturn(java.util.List.of(awa));

    authService.updateProfile(
        7L,
        new com.avicare.identity.dto.request.UpdateProfileRequest("Awa Diop", "771842787", null));

    assertThat(awa.getPhone()).isEqualTo("771842787");
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

  // --- changing your own password -----------------------------------------

  private User existingUser(String rawPassword) {
    User user = new User();
    user.setId(4L);
    user.setEmail("awa@avicare.io");
    user.setPasswordHash(ENCODER.encode(rawPassword));
    user.setActive(true);
    when(userRepository.findById(4L)).thenReturn(Optional.of(user));
    return user;
  }

  @Test
  void changePassword_replacesTheHash_andRevokesEverySession() {
    User user = existingUser("ancien-mot-de-passe");

    authService.changePassword(
        4L, new ChangePasswordRequest("ancien-mot-de-passe", "NouveauPass1"));

    assertThat(ENCODER.matches("NouveauPass1", user.getPasswordHash())).isTrue();
    // Changing a password usually means someone else may know the old one; leaving their session
    // alive would defeat the point.
    verify(refreshTokenService).revokeAllForUser(4L);
  }

  @Test
  void changePassword_wrongCurrent_isRefusedAndChangesNothing() {
    User user = existingUser("ancien-mot-de-passe");
    String before = user.getPasswordHash();

    // An authenticated token is not enough on its own: a machine left unlocked must not hand the
    // account over for good.
    assertThatThrownBy(
            () -> authService.changePassword(4L, new ChangePasswordRequest("faux", "NouveauPass1")))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("actuel");
    assertThat(user.getPasswordHash()).isEqualTo(before);
    verify(refreshTokenService, never()).revokeAllForUser(any());
  }

  @Test
  void changePassword_sameAsCurrent_isRefused() {
    existingUser("ancien-mot-de-passe");

    // Otherwise "change your password" is satisfiable without changing anything.
    assertThatThrownBy(
            () ->
                authService.changePassword(
                    4L, new ChangePasswordRequest("ancien-mot-de-passe", "ancien-mot-de-passe")))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("différent");
    verify(refreshTokenService, never()).revokeAllForUser(any());
  }
}
