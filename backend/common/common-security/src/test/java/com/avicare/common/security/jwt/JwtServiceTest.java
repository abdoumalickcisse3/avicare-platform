package com.avicare.common.security.jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.security.exception.ExpiredTokenException;
import com.avicare.common.security.exception.InvalidTokenException;
import com.avicare.common.security.exception.WrongTokenTypeException;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.Membership;
import com.avicare.common.security.principal.UserRole;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

class JwtServiceTest {

  private static String privatePem;
  private static String publicPem;
  private static String otherPublicPem;

  @BeforeAll
  static void generateKeys() {
    KeyPair main = RsaTestKeys.generate();
    privatePem = RsaTestKeys.privatePem(main);
    publicPem = RsaTestKeys.publicPem(main);

    KeyPair stranger = RsaTestKeys.generate();
    otherPublicPem = RsaTestKeys.publicPem(stranger);
  }

  private static JwtService service(Duration accessTtl, Duration refreshTtl, String pubPem) {
    JwtProperties props =
        new JwtProperties(
            "avicare-test", accessTtl, refreshTtl, null, null, privatePem, pubPem);
    KeyLoader loader = new KeyLoader(new DefaultResourceLoader(), props);
    JwtService svc = new JwtService(props, loader, new ObjectMapper());
    svc.init();
    return svc;
  }

  private static JwtService normalService() {
    return service(Duration.ofMinutes(15), Duration.ofDays(7), publicPem);
  }

  private static AvicarePrincipal samplePrincipal() {
    return new AvicarePrincipal(
        42L,
        "alice@avicare.io",
        UserRole.USER,
        List.of(
            new Membership(100L, FarmRole.OWNER, List.of("*")),
            new Membership(
                200L, FarmRole.FARMER, List.of("poultry:read", "poultry:write"))));
  }

  @Test
  void generatesAndValidatesAccessToken() {
    JwtService svc = normalService();
    AvicarePrincipal original = samplePrincipal();

    String token = svc.generateAccessToken(original);
    AvicarePrincipal restored = svc.validateAccessToken(token);

    assertThat(restored.userId()).isEqualTo(original.userId());
    assertThat(restored.email()).isEqualTo(original.email());
    assertThat(restored.role()).isEqualTo(original.role());
    assertThat(restored.memberships()).isEqualTo(original.memberships());
  }

  @Test
  void generatesAndValidatesRefreshToken() {
    JwtService svc = normalService();

    String refresh = svc.generateRefreshToken(42L);
    Long userId = svc.validateRefreshToken(refresh);

    assertThat(userId).isEqualTo(42L);
  }

  @Test
  void rejectsExpiredAccessToken() throws InterruptedException {
    JwtService svc = service(Duration.ofMillis(1), Duration.ofDays(7), publicPem);
    String token = svc.generateAccessToken(samplePrincipal());

    Thread.sleep(50);

    assertThatThrownBy(() -> svc.validateAccessToken(token))
        .isInstanceOf(ExpiredTokenException.class);
  }

  @Test
  void rejectsTokenSignedWithWrongKey() {
    JwtService signer = normalService();
    JwtService verifierWithDifferentPublicKey =
        service(Duration.ofMinutes(15), Duration.ofDays(7), otherPublicPem);

    String token = signer.generateAccessToken(samplePrincipal());

    assertThatThrownBy(() -> verifierWithDifferentPublicKey.validateAccessToken(token))
        .isInstanceOf(InvalidTokenException.class);
  }

  @Test
  void rejectsAccessTokenWhenRefreshExpected() {
    JwtService svc = normalService();
    String access = svc.generateAccessToken(samplePrincipal());

    assertThatThrownBy(() -> svc.validateRefreshToken(access))
        .isInstanceOf(WrongTokenTypeException.class)
        .hasMessageContaining("expected 'refresh'");
  }

  @Test
  void rejectsRefreshTokenWhenAccessExpected() {
    JwtService svc = normalService();
    String refresh = svc.generateRefreshToken(42L);

    assertThatThrownBy(() -> svc.validateAccessToken(refresh))
        .isInstanceOf(WrongTokenTypeException.class)
        .hasMessageContaining("expected 'access'");
  }

  @Test
  void roundTripsMembershipsThroughClaims() {
    JwtService svc = normalService();
    Membership m1 = new Membership(1L, FarmRole.OWNER, List.of("*"));
    Membership m2 = new Membership(2L, FarmRole.FARMER, List.of("poultry:read"));
    AvicarePrincipal original =
        new AvicarePrincipal(7L, "bob@avicare.io", UserRole.USER, List.of(m1, m2));

    String token = svc.generateAccessToken(original);
    AvicarePrincipal restored = svc.validateAccessToken(token);

    assertThat(restored.memberships()).hasSize(2);
    assertThat(restored.memberships().get(0).farmRole()).isEqualTo(FarmRole.OWNER);
    assertThat(restored.memberships().get(0).hasPermission("anything:anything")).isTrue();
    assertThat(restored.memberships().get(1).farmRole()).isEqualTo(FarmRole.FARMER);
    assertThat(restored.memberships().get(1).hasPermission("poultry:read")).isTrue();
    assertThat(restored.memberships().get(1).hasPermission("poultry:write")).isFalse();
  }

  @Test
  void roundTripsUserRoleAsEnum() {
    JwtService svc = normalService();
    AvicarePrincipal adminPrincipal =
        new AvicarePrincipal(1L, "boss@avicare.io", UserRole.ADMIN, List.of());

    String token = svc.generateAccessToken(adminPrincipal);
    AvicarePrincipal restored = svc.validateAccessToken(token);

    assertThat(restored.role()).isEqualTo(UserRole.ADMIN);
    assertThat(restored.isAdmin()).isTrue();
  }

  @Test
  void rejectsTokenWithUnknownRole() throws Exception {
    JwtService svc = normalService();
    String forged = forgeAccessTokenWithRoleClaim("PHANTOM_ROLE");

    assertThatThrownBy(() -> svc.validateAccessToken(forged))
        .isInstanceOf(InvalidTokenException.class)
        .hasMessageContaining("Cannot reconstruct principal");
  }

  /** Builds an access token whose {@code role} claim is an arbitrary string. */
  private static String forgeAccessTokenWithRoleClaim(String role) {
    JwtProperties props =
        new JwtProperties(
            "avicare-test",
            Duration.ofMinutes(15),
            Duration.ofDays(7),
            null,
            null,
            privatePem,
            publicPem);
    KeyLoader loader = new KeyLoader(new DefaultResourceLoader(), props);
    java.security.interfaces.RSAPrivateKey pk = loader.loadPrivateKey();

    java.util.Date now = new java.util.Date();
    java.util.Date exp = new java.util.Date(now.getTime() + 60_000);
    return io.jsonwebtoken.Jwts.builder()
        .issuer("avicare-test")
        .subject("1")
        .id(java.util.UUID.randomUUID().toString())
        .issuedAt(now)
        .expiration(exp)
        .claims(
            java.util.Map.of(
                "email", "phantom@avicare.io",
                "role", role,
                "memberships", java.util.List.of(),
                "type", "access"))
        .signWith(pk, io.jsonwebtoken.Jwts.SIG.RS256)
        .compact();
  }

  @Test
  void garbageInput_isReportedAsInvalid() {
    JwtService svc = normalService();

    assertThatThrownBy(() -> svc.validateAccessToken("not-a-jwt"))
        .isInstanceOf(InvalidTokenException.class);
  }

  @Test
  void unconfiguredService_throwsClearError() {
    JwtProperties empty =
        new JwtProperties(
            "avicare-test", Duration.ofMinutes(15), Duration.ofDays(7), null, null, null, null);
    KeyLoader loader = new KeyLoader(new DefaultResourceLoader(), empty);
    JwtService svc = new JwtService(empty, loader, new ObjectMapper());
    svc.init();

    AvicarePrincipal principal = samplePrincipal();

    assertThatThrownBy(() -> svc.generateAccessToken(principal))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("not initialized");
    assertThatThrownBy(() -> svc.generateRefreshToken(1L))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> svc.validateAccessToken("anything"))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> svc.validateRefreshToken("anything"))
        .isInstanceOf(IllegalStateException.class);
  }
}
