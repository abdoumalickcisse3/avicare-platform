package com.avicare.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Every host Caddy serves must be an allowed CORS origin.
 *
 * <p>Caddy proxies {@code /api} to {@code backend:8080} over plain http, so Spring compares the
 * browser's {@code Origin} against that internal address and treats every call as cross-origin —
 * even the ones a browser considers same-origin. A front deployed on a new subdomain therefore
 * fails at login with {@code 403 Invalid CORS request} until its origin is listed.
 *
 * <p>That failure is invisible to the usual smoke test: {@code curl} sends no {@code Origin}
 * header, so the endpoint answers 200 while every real browser is refused. This test is the
 * substitute for the check a human cannot be relied on to repeat.
 */
class CorsOriginsCoverDeployedHostsTest {

  private static final Path REPO_ROOT = Path.of("..", "..");
  private static final String DOMAIN = "jawdi.app";

  /**
   * The placeholder every vhost line carries — and that inner blocks such as {@code handle} do not.
   */
  private static final String DOMAIN_PLACEHOLDER = "{$DOMAIN}";

  private String read(String relative) throws IOException {
    Path path = REPO_ROOT.resolve(relative);
    assertThat(path).as("%s — move this file and this test must follow", relative).isRegularFile();
    return Files.readString(path);
  }

  private List<String> deployedHosts() throws IOException {
    return read("infra/Caddyfile")
        .lines()
        .map(String::strip)
        // A vhost line opens a block and names the domain; `handle @backend {` does neither.
        .filter(line -> line.endsWith("{") && line.contains(DOMAIN_PLACEHOLDER))
        .map(line -> line.substring(0, line.length() - 1))
        .flatMap(line -> Arrays.stream(line.split(",")))
        .map(host -> host.strip().replace(DOMAIN_PLACEHOLDER, DOMAIN))
        .filter(host -> !host.isBlank())
        .toList();
  }

  private String allowedOrigins() throws IOException {
    Matcher m =
        Pattern.compile("allowed-origins:\\s*\\$\\{CORS_ALLOWED_ORIGINS:([^}]+)}")
            .matcher(read("backend/avicare-app/src/main/resources/application-prod.yml"));
    assertThat(m.find()).as("allowed-origins default not found in application-prod.yml").isTrue();
    return m.group(1);
  }

  @Test
  void everyHostCaddyServesIsAnAllowedOrigin() throws IOException {
    List<String> hosts = deployedHosts();
    // A regex that silently matched nothing would make this test pass forever.
    assertThat(hosts).contains(DOMAIN, "app." + DOMAIN, "partner." + DOMAIN, "admin." + DOMAIN);

    String origins = allowedOrigins();
    assertThat(hosts)
        .allSatisfy(
            host ->
                assertThat(List.of(origins.split(",")))
                    .as("host %s is served by Caddy but its origin is not allowed", host)
                    .contains("https://" + host));
  }

  @Test
  void theComposeFileDerivesTheSameListFromDomain() throws IOException {
    String compose = read("infra/docker-compose.prod.yml");
    // Setting the variable in .env alone does nothing unless compose forwards it — the trap that
    // already swallowed ADMIN_FOUNDER_EMAIL once.
    assertThat(compose).contains("CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:-");
    for (String host : deployedHosts()) {
      assertThat(compose)
          .as("compose fallback misses %s", host)
          .contains("https://" + host.replace(DOMAIN, "${DOMAIN}"));
    }
  }
}
