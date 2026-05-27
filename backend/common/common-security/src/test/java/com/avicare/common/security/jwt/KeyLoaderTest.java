package com.avicare.common.security.jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.KeyPair;
import java.time.Duration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

class KeyLoaderTest {

  private static String privatePem;
  private static String publicPem;

  @BeforeAll
  static void generateKeys() {
    KeyPair pair = RsaTestKeys.generate();
    privatePem = RsaTestKeys.privatePem(pair);
    publicPem = RsaTestKeys.publicPem(pair);
  }

  @Test
  void loadsKeyPairFromInlinePem() {
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

    assertThat(loader.loadPrivateKey().getAlgorithm()).isEqualTo("RSA");
    assertThat(loader.loadPublicKey().getAlgorithm()).isEqualTo("RSA");
  }

  @Test
  void inlinePemTakesPrecedenceOverPath() {
    JwtProperties props =
        new JwtProperties(
            "avicare-test",
            Duration.ofMinutes(15),
            Duration.ofDays(7),
            "classpath:does-not-exist.pem",
            "classpath:does-not-exist.pem",
            privatePem,
            publicPem);
    KeyLoader loader = new KeyLoader(new DefaultResourceLoader(), props);

    assertThat(loader.loadPrivateKey()).isNotNull();
    assertThat(loader.loadPublicKey()).isNotNull();
  }

  @Test
  void missingPathAndPem_throwsClearError() {
    JwtProperties props =
        new JwtProperties(
            "avicare-test", Duration.ofMinutes(15), Duration.ofDays(7), null, null, null, null);
    KeyLoader loader = new KeyLoader(new DefaultResourceLoader(), props);

    assertThatThrownBy(loader::loadPrivateKey)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("No JWT private key configured");
    assertThatThrownBy(loader::loadPublicKey)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("No JWT public key configured");
  }

  @Test
  void corruptedPem_throwsClearError() {
    JwtProperties props =
        new JwtProperties(
            "avicare-test",
            Duration.ofMinutes(15),
            Duration.ofDays(7),
            null,
            null,
            "-----BEGIN PRIVATE KEY-----\nNOT_BASE64!!!\n-----END PRIVATE KEY-----",
            publicPem);
    KeyLoader loader = new KeyLoader(new DefaultResourceLoader(), props);

    assertThatThrownBy(loader::loadPrivateKey)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Failed to parse JWT private key");
  }

  @Test
  void unresolvablePath_throwsIoLikeError() {
    JwtProperties props =
        new JwtProperties(
            "avicare-test",
            Duration.ofMinutes(15),
            Duration.ofDays(7),
            "classpath:nope/private.pem",
            "classpath:nope/public.pem",
            null,
            null);
    KeyLoader loader = new KeyLoader(new DefaultResourceLoader(), props);

    assertThatThrownBy(loader::loadPrivateKey)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Failed to read JWT private key");
  }
}
