package com.avicare.common.security.jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.avicare.common.security.exception.WrongTokenTypeException;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.PartnerPrincipal;
import com.avicare.common.security.principal.UserRole;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.KeyPair;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

/** Partner-token generation/validation and the cross-audience cloisonnement guarantee. */
class JwtServicePartnerTest {

  private static String privatePem;
  private static String publicPem;

  @BeforeAll
  static void generateKeys() {
    KeyPair main = RsaTestKeys.generate();
    privatePem = RsaTestKeys.privatePem(main);
    publicPem = RsaTestKeys.publicPem(main);
  }

  private static JwtService service() {
    JwtProperties props =
        new JwtProperties(
            "avicare-test",
            Duration.ofMinutes(15),
            Duration.ofDays(7),
            null,
            null,
            privatePem,
            publicPem);
    JwtService svc =
        new JwtService(
            props, new KeyLoader(new DefaultResourceLoader(), props), new ObjectMapper());
    svc.init();
    return svc;
  }

  @Test
  void partnerAccessTokenRoundTrips() {
    JwtService jwtService = service();
    String t = jwtService.generatePartnerAccessToken(new PartnerPrincipal(5L, "p@x.io", 3L));

    PartnerPrincipal p = jwtService.validatePartnerAccessToken(t);
    assertThat(p.partnerUserId()).isEqualTo(5L);
    assertThat(p.partnerId()).isEqualTo(3L);
    assertThat(p.email()).isEqualTo("p@x.io");
  }

  @Test
  void farmerAccessTokenRejectedByPartnerValidation() {
    JwtService jwtService = service();
    String farmer =
        jwtService.generateAccessToken(
            new AvicarePrincipal(1L, "u@x.io", UserRole.USER, List.of()));

    assertThatThrownBy(() -> jwtService.validatePartnerAccessToken(farmer))
        .isInstanceOf(WrongTokenTypeException.class);
  }

  @Test
  void partnerAccessTokenRejectedByFarmerValidation() {
    JwtService jwtService = service();
    String partner = jwtService.generatePartnerAccessToken(new PartnerPrincipal(5L, "p@x.io", 3L));

    assertThatThrownBy(() -> jwtService.validateAccessToken(partner))
        .isInstanceOf(WrongTokenTypeException.class);
  }
}
