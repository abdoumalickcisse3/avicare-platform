package com.avicare.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The settings that decide whether an alert ever reaches a phone.
 *
 * <p>Three defects of the same shape shipped unnoticed, because none of them breaks anything
 * visible: the app starts, the API answers, the bell fills up. Only the message never leaves.
 *
 * <ul>
 *   <li>{@code notifications.scan.cron} was pinned to {@code 0 0 6 * * *} in {@code
 *       application.yml}, so the hourly cadence written on {@code @Scheduled} as a fallback was
 *       never read — a property that <em>exists</em> is never replaced by an annotation default.
 *   <li>{@code NOTIF_WHATSAPP_ENABLED} defaulted to {@code false} in the compose file, which
 *       overrides the {@code true} of {@code application-prod.yml}: nothing was sent at all.
 *   <li>{@code NOTIF_APP_URL} was passed <em>empty</em>, and an empty variable is a resolved value
 *       for Spring — so it overrode the production URL and every message went out without its deep
 *       link.
 * </ul>
 *
 * <p>The common lesson: a value written twice is a value that can disagree with itself, and the
 * layer closest to the container wins. This test pins the effective defaults so the disagreement
 * fails a build instead of a farm.
 */
class NotificationDeliveryConfigTest {

  private static final Path REPO_ROOT = Path.of("..", "..");
  private static final Path APPLICATION_YML =
      Path.of("src", "main", "resources", "application.yml");
  private static final Path COMPOSE_PROD =
      REPO_ROOT.resolve(Path.of("infra", "docker-compose.prod.yml"));

  private static String read(Path path) throws IOException {
    assertThat(path).as("config file to check").exists();
    return Files.readString(path);
  }

  /** The fallback baked into a {@code ${VAR:-fallback}} of a compose environment entry. */
  private static String composeFallback(String content, String var) {
    Matcher m =
        Pattern.compile("^\\s*" + var + ":\\s*\\$\\{" + var + ":-(.*)}\\s*$", Pattern.MULTILINE)
            .matcher(content);
    assertThat(m.find()).as("%s is passed by docker-compose.prod.yml", var).isTrue();
    return m.group(1).trim();
  }

  @Test
  @DisplayName("the scan runs hourly through the working day, not once at dawn")
  void scanCadenceIsHourly() throws IOException {
    String yml = read(APPLICATION_YML);

    Matcher m = Pattern.compile("cron:\\s*\\$\\{NOTIF_SCAN_CRON:([^}]*)}").matcher(yml);
    assertThat(m.find()).as("notifications.scan.cron is defined in application.yml").isTrue();
    String cron = m.group(1).trim();

    // A range of hours, not a single one: "0 0 6 * * *" would be one pass a day.
    assertThat(cron)
        .as(
            "the value in application.yml is the one that applies — the @Scheduled fallback "
                + "is dead code as long as the property exists here")
        .matches("0 0 \\d{1,2}-\\d{1,2} \\* \\* \\*");
  }

  @Test
  @DisplayName("the compose file does not silently disable WhatsApp in production")
  void composeDoesNotOverrideWhatsappFlag() throws IOException {
    assertThat(composeFallback(read(COMPOSE_PROD), "NOTIF_WHATSAPP_ENABLED"))
        .as(
            "a `false` fallback here beats the `true` of application-prod.yml, and nothing is "
                + "sent — with no error anywhere. Disabling must be a deliberate act, not a default")
        .isEqualTo("true");
  }

  @Test
  @DisplayName("the compose file does not blank the public URL the deep links are built from")
  void composeDoesNotBlankAppUrl() throws IOException {
    String fallback = composeFallback(read(COMPOSE_PROD), "NOTIF_APP_URL");

    assertThat(fallback)
        .as("an empty value is a resolved value: it overrides the production default")
        .isNotEmpty()
        .startsWith("https://");
  }
}
