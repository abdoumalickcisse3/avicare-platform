package com.avicare.common.security.jwt;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;

/**
 * Test helper that generates RSA-2048 key pairs in-memory and renders them as PEM strings, so the
 * security tests don't need any key file on disk.
 */
final class RsaTestKeys {

  private RsaTestKeys() {}

  static KeyPair generate() {
    try {
      KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
      gen.initialize(2048);
      return gen.generateKeyPair();
    } catch (Exception e) {
      throw new IllegalStateException("Cannot generate RSA key pair", e);
    }
  }

  static String privatePem(KeyPair pair) {
    String base64 = Base64.getEncoder().encodeToString(((RSAPrivateKey) pair.getPrivate()).getEncoded());
    return "-----BEGIN PRIVATE KEY-----\n" + wrap(base64) + "\n-----END PRIVATE KEY-----";
  }

  static String publicPem(KeyPair pair) {
    String base64 = Base64.getEncoder().encodeToString(((RSAPublicKey) pair.getPublic()).getEncoded());
    return "-----BEGIN PUBLIC KEY-----\n" + wrap(base64) + "\n-----END PUBLIC KEY-----";
  }

  private static String wrap(String base64) {
    StringBuilder sb = new StringBuilder(base64.length() + base64.length() / 64);
    for (int i = 0; i < base64.length(); i += 64) {
      sb.append(base64, i, Math.min(i + 64, base64.length())).append('\n');
    }
    return sb.toString().stripTrailing();
  }
}
