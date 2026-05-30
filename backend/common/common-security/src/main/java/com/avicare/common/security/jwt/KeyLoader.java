package com.avicare.common.security.jwt;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

/**
 * Loads RSA key pairs used to sign and verify JWTs.
 *
 * <p>Each {@code load*} method prefers the raw PEM string in {@link JwtProperties} over the Spring
 * resource path, which lets prod read keys from environment variables while keeping dev easy with a
 * classpath file.
 *
 * <p>PEM parsing is intentionally tolerant: header/footer lines are stripped and every whitespace
 * character is removed before Base64 decoding, so files with mixed line endings or indentation
 * don't trip the loader.
 */
@Component
@RequiredArgsConstructor
public class KeyLoader {

  private final ResourceLoader resourceLoader;
  private final JwtProperties props;

  public RSAPrivateKey loadPrivateKey() {
    String pem = resolvePem(props.privateKey(), props.privateKeyPath(), "private");
    String cleaned =
        pem.replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
    try {
      byte[] decoded = Base64.getDecoder().decode(cleaned);
      PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(decoded);
      return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(spec);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to parse JWT private key (PKCS#8 expected)", e);
    }
  }

  public RSAPublicKey loadPublicKey() {
    String pem = resolvePem(props.publicKey(), props.publicKeyPath(), "public");
    String cleaned =
        pem.replace("-----BEGIN PUBLIC KEY-----", "")
            .replace("-----END PUBLIC KEY-----", "")
            .replaceAll("\\s", "");
    try {
      byte[] decoded = Base64.getDecoder().decode(cleaned);
      X509EncodedKeySpec spec = new X509EncodedKeySpec(decoded);
      return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(spec);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to parse JWT public key (X.509 expected)", e);
    }
  }

  private String resolvePem(String inlinePem, String path, String label) {
    if (inlinePem != null && !inlinePem.isBlank()) {
      return inlinePem;
    }
    if (path != null && !path.isBlank()) {
      try {
        Resource resource = resourceLoader.getResource(path);
        try (InputStream is = resource.getInputStream()) {
          return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
      } catch (IOException e) {
        throw new IllegalStateException(
            "Failed to read JWT " + label + " key from path " + path, e);
      }
    }
    throw new IllegalStateException(
        "No JWT "
            + label
            + " key configured. Set 'avicare.security.jwt."
            + label
            + "Key' (raw PEM) or 'avicare.security.jwt."
            + label
            + "KeyPath' (resource path).");
  }
}
