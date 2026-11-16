package com.avicare.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The OpenAPI contract and the Swagger console are served in production, and two separate files
 * decide what that costs.
 *
 * <p>{@code application-prod.yml} turns them on; {@code infra/Caddyfile} decides who can reach
 * them. Split like that, the pair drifts quietly: somebody adds a path to a vhost, or tidies a
 * {@code basic_auth} away, and a page that lists every route — and calls them, against the real
 * database, through <i>Try it out</i> — goes up for anyone who guesses the address. Nothing fails,
 * nothing is logged, and the mistake is invisible until it is used.
 *
 * <p>So this test reads both files and holds three rules:
 *
 * <ol>
 *   <li>exactly one vhost routes those paths, and it is the back-office one;
 *   <li>on that vhost they sit behind a password;
 *   <li>all three path families are covered — the address, the assets it redirects to, and the
 *       contract the page downloads afterwards.
 * </ol>
 */
class SwaggerIsLockedInProductionTest {

  private static final Path REPO_ROOT = Path.of("..", "..");

  /**
   * The placeholder every vhost line carries — and that inner blocks such as {@code handle} do not.
   */
  private static final String DOMAIN_PLACEHOLDER = "{$DOMAIN}";

  /** The vhost allowed to serve the contract and the console. */
  private static final String BACK_OFFICE = "admin";

  /**
   * The console is served in three pieces: the address one types, the assets it redirects to, and
   * the contract the page fetches next. Protecting two of the three protects nothing.
   */
  private static final List<String> CONSOLE_PATHS =
      List.of("/swagger", "/swagger-ui", "/v3/api-docs");

  private String read(String relative) throws IOException {
    Path path = REPO_ROOT.resolve(relative);
    assertThat(path).as("%s — move this file and this test must follow", relative).isRegularFile();
    return Files.readString(path);
  }

  /** Vhost name (the label before {@code .{$DOMAIN}}) to the lines of its block. */
  private Map<String, List<String>> vhosts() throws IOException {
    Map<String, List<String>> blocks = new LinkedHashMap<>();
    String current = null;
    int depth = 0;
    for (String raw : read("infra/Caddyfile").lines().toList()) {
      String line = raw.strip();
      if (current == null) {
        if (line.endsWith("{") && line.contains(DOMAIN_PLACEHOLDER)) {
          current = line.substring(0, line.indexOf(DOMAIN_PLACEHOLDER)).replace(".", "").strip();
          // A line such as `{$DOMAIN}, www.{$DOMAIN} {` names the apex: call it by its own name.
          if (current.isEmpty()) {
            current = "apex";
          }
          blocks.put(current, new ArrayList<>());
          depth = 1;
        }
        continue;
      }
      depth += count(line, '{') - count(line, '}');
      if (depth <= 0) {
        current = null;
        continue;
      }
      blocks.get(current).add(line);
    }
    return blocks;
  }

  private static int count(String line, char c) {
    return (int) line.chars().filter(ch -> ch == c).count();
  }

  /** Whether this vhost routes anything of the console, by any of its path families. */
  private static boolean routesTheConsole(List<String> block) {
    return block.stream()
        .filter(line -> !line.startsWith("#"))
        .filter(line -> line.startsWith("@") || line.startsWith("path "))
        .anyMatch(line -> CONSOLE_PATHS.stream().anyMatch(line::contains));
  }

  @Test
  @DisplayName("only the back-office vhost routes the contract and the console")
  void onlyTheBackOfficeServesIt() throws IOException {
    Map<String, List<String>> vhosts = vhosts();
    assertThat(vhosts).as("the Caddyfile should declare several vhosts").hasSizeGreaterThan(2);

    List<String> serving =
        vhosts.entrySet().stream()
            .filter(e -> routesTheConsole(e.getValue()))
            .map(Map.Entry::getKey)
            .toList();

    assertThat(serving)
        .as(
            "the farmer app and the partner portal must not route /swagger* or /v3/api-docs*: "
                + "the page maps every route and its Try it out writes to the real database")
        .containsExactly(BACK_OFFICE);
  }

  @Test
  @DisplayName("on that vhost, the console sits behind a password")
  void theConsoleIsBehindAPassword() throws IOException {
    List<String> block = vhosts().get(BACK_OFFICE);
    assertThat(block).as("no %s vhost in the Caddyfile", BACK_OFFICE).isNotNull();

    int matcher = indexOfConsoleMatcher(block);
    assertThat(matcher).as("no path matcher for the console on %s", BACK_OFFICE).isNotNegative();

    // The handler that follows the matcher must ask for a password before proxying anything.
    List<String> handler = block.subList(matcher, block.size());
    int proxy = indexOfLineContaining(handler, "reverse_proxy");
    int lock = indexOfLineContaining(handler, "basic_auth");
    assertThat(lock)
        .as("the console is proxied with no basic_auth in front of it")
        .isNotNegative()
        .isLessThan(proxy);
  }

  @Test
  @DisplayName("the three pieces of the console are protected together, not one of them")
  void everyPieceIsCovered() throws IOException {
    List<String> block = vhosts().get(BACK_OFFICE);
    int matcher = indexOfConsoleMatcher(block);
    assertThat(matcher).as("no path matcher for the console on %s", BACK_OFFICE).isNotNegative();
    String matcherLine = block.get(matcher);

    assertThat(matcherLine)
        .as("a path family left out here is a way around the password")
        .contains(CONSOLE_PATHS);
  }

  @Test
  @DisplayName("the password itself never appears in the file")
  void theHashComesFromTheEnvironment() throws IOException {
    String caddyfile = read("infra/Caddyfile");

    // A bcrypt hash starts with $2a$ / $2b$ / $2y$. In this file it may only appear as a
    // placeholder read from the environment.
    assertThat(caddyfile)
        .as("a hash pasted into the Caddyfile is a secret committed to the repository")
        .doesNotContain("$2a$", "$2b$", "$2y$");
    assertThat(caddyfile).contains("{$SWAGGER_UI_PASSWORD_HASH}");
  }

  @Test
  @DisplayName(
      "production really does serve the contract — the lock is the proxy's, not an off switch")
  void productionServesTheContract() throws IOException {
    String prod = read("backend/avicare-app/src/main/resources/application-prod.yml");

    // Only the springdoc block is read: an `enabled: false` elsewhere in the file is somebody
    // else's setting, and failing on it would make this test lie about what broke.
    List<String> springdoc = new ArrayList<>();
    boolean inside = false;
    for (String raw : prod.lines().toList()) {
      if (raw.startsWith("springdoc:")) {
        inside = true;
        continue;
      }
      // A new top-level key ends the block; blank and indented lines do not.
      if (inside && !raw.isBlank() && !Character.isWhitespace(raw.charAt(0))) {
        break;
      }
      if (inside) {
        springdoc.add(raw.strip());
      }
    }

    assertThat(springdoc)
        .as("no springdoc block in application-prod.yml")
        .isNotEmpty()
        .as("springdoc disabled in prod would make the console a 404 behind a password")
        .doesNotContain("enabled: false");
  }

  /**
   * Finds a directive, never a comment. The block is heavily commented and those comments name the
   * very paths being looked for, so a plain substring search lands on prose and the test then
   * reports on a sentence instead of on the configuration.
   */
  private static int indexOfLineContaining(List<String> lines, String needle) {
    for (int i = 0; i < lines.size(); i++) {
      String line = lines.get(i);
      if (!line.startsWith("#") && line.contains(needle)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * The matcher line that names the console's paths: starts with {@code @}, carries {@code path}.
   */
  private static int indexOfConsoleMatcher(List<String> lines) {
    for (int i = 0; i < lines.size(); i++) {
      String line = lines.get(i);
      if (line.startsWith("@") && line.contains("path ") && line.contains("/swagger")) {
        return i;
      }
    }
    return -1;
  }
}
