package com.avicare.common.security.jwt;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * JWT configuration bound from {@code avicare.security.jwt.*}.
 *
 * <p>Either {@code privateKey}/{@code publicKey} (PEM strings, useful in prod from env vars) or
 * {@code privateKeyPath}/{@code publicKeyPath} (Spring resource paths, useful in dev from
 * classpath) must be provided. The PEM-string form takes precedence.
 *
 * <p>Each token type carries its own TTL; an access token is short-lived and a refresh token is
 * long-lived.
 *
 * @param issuer value placed in the {@code iss} claim and required on validation
 * @param accessTokenTtl access token validity duration
 * @param refreshTokenTtl refresh token validity duration
 * @param privateKeyPath Spring resource path to the PEM-encoded private key (PKCS#8)
 * @param publicKeyPath Spring resource path to the PEM-encoded public key (X.509)
 * @param privateKey raw PEM-encoded private key (PKCS#8)
 * @param publicKey raw PEM-encoded public key (X.509)
 */
@ConfigurationProperties(prefix = "avicare.security.jwt")
public record JwtProperties(
    String issuer,
    Duration accessTokenTtl,
    Duration refreshTokenTtl,
    String privateKeyPath,
    String publicKeyPath,
    String privateKey,
    String publicKey) {}
