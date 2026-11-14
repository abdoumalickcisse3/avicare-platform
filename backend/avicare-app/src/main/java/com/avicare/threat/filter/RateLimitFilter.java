package com.avicare.threat.filter;

import com.avicare.common.api.web.ClientIp;
import com.avicare.threat.service.ThreatDetectionService;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;
import tools.jackson.databind.ObjectMapper;

/**
 * Caps how fast one address can hit the API.
 *
 * <p><b>Keyed by address, not by user.</b> This runs before authentication — deliberately, so that
 * an unauthenticated flood costs nothing — which means there is no user to key on yet. Per-account
 * protection is the brute-force detector's job, one layer down: it sees the email that was tried,
 * which this filter cannot.
 *
 * <p><b>Buckets live in memory.</b> There is one backend instance; a distributed counter would mean
 * a database write per request to coordinate with nobody. The map is keyed by address, so it is
 * bounded by distinct callers, and it is emptied hourly — a bucket refills on its own, so
 * forgetting one is at worst a forgiven request. Should a second instance ever appear, what changes
 * is the store, not the rules (cf. ADR-013).
 */
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

  /** What a route costs, and how much of it one address gets. */
  private enum Route {
    /** Sign-in: tight, because this is what gets brute-forced. */
    LOGIN(5, Duration.ofMinutes(1)),
    /**
     * Account creation. Not as tight as it first looks it should be: a cooperative onboarding its
     * members from one office shares a single operator address, and refusing the fourth of them
     * would be the platform getting in the way of its own adoption. Bursts are still <i>noticed</i>
     * at three an hour — the detector warns, this filter only refuses well past that.
     */
    SIGNUP(10, Duration.ofHours(1)),
    /** Password reset: sends a WhatsApp credit downrange with every request. */
    PASSWORD_RESET(5, Duration.ofHours(1)),
    /** Back-office: generous for a human, obviously wrong for a scraper. */
    ADMIN(30, Duration.ofMinutes(1)),
    /**
     * Field survey submissions — the only write on the platform that needs no token. Five an hour
     * is far above what one honest respondent does (they answer once) and far below what makes
     * stuffing the averages worthwhile. Reading the results is deliberately <i>not</i> this route:
     * that page is meant to be shown around, cooperatives included, and they share one connection.
     */
    SURVEY(5, Duration.ofHours(1)),
    /** Everything else: high enough that the mobile app syncing never notices. */
    DEFAULT(100, Duration.ofMinutes(1));

    private final int capacity;
    private final Duration window;

    Route(int capacity, Duration window) {
      this.capacity = capacity;
      this.window = window;
    }

    Bucket newBucket() {
      return Bucket.builder()
          .addLimit(Bandwidth.builder().capacity(capacity).refillGreedy(capacity, window).build())
          .build();
    }

    static Route of(String method, String path) {
      if (path.startsWith("/api/v1/auth/login") || path.startsWith("/api/v1/partner/auth/login")) {
        return LOGIN;
      }
      if (path.startsWith("/api/v1/auth/signup")) {
        return SIGNUP;
      }
      if (path.startsWith("/api/v1/auth/password-reset")) {
        return PASSWORD_RESET;
      }
      if (path.startsWith("/api/v1/admin")) {
        return ADMIN;
      }
      // Writes under the survey prefix only. Reading the results sits underneath and stays on the
      // generous default — showing the figures to a cooperative must not lock them all out.
      if (!"GET".equals(method) && path.startsWith("/api/v1/public/survey")) {
        return SURVEY;
      }
      return DEFAULT;
    }
  }

  /**
   * Decodes the path and drops path parameters before the route is chosen.
   *
   * <p>Matched on the raw URI, a ceiling has a side door: {@code /api/v1/public/survey/}, {@code
   * …/survey;jsessionid=…} and {@code …/%73urvey} all reach the same controller while reading as
   * three different strings, and each would have drawn its own allowance.
   */
  private static final UrlPathHelper PATHS = new UrlPathHelper();

  private static String normalisedPath(HttpServletRequest request) {
    String path = PATHS.getPathWithinApplication(request);
    while (path.length() > 1 && path.endsWith("/")) {
      path = path.substring(0, path.length() - 1);
    }
    return path;
  }

  private final ThreatDetectionService threatDetection;
  private final ObjectMapper objectMapper;
  private final boolean enabled;

  private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !enabled
        || "OPTIONS".equals(request.getMethod())
        || request.getRequestURI().startsWith("/actuator")
        // Local callers are exempt: behind Caddy a real one never looks loopback, so this is a
        // test, a probe, or something already on the box. See ThreatDetectionService.
        || ThreatDetectionService.isLoopback(ClientIp.of(request));
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    Route route = Route.of(request.getMethod(), normalisedPath(request));
    String ip = ClientIp.of(request);
    Bucket bucket = buckets.computeIfAbsent(route.name() + "|" + ip, key -> route.newBucket());

    if (bucket.tryConsume(1)) {
      chain.doFilter(request, response);
      return;
    }

    threatDetection.recordRateLimitExceeded(ip, request.getRequestURI());
    response.setHeader("Retry-After", String.valueOf(route.window.toSeconds()));
    ProblemWriter.write(
        objectMapper,
        request,
        response,
        429,
        "too-many-requests",
        "Too Many Requests",
        "TOO_MANY_REQUESTS",
        "Trop de requêtes. Réessayez dans un instant.");
  }

  /**
   * Empties the bucket map hourly.
   *
   * <p>Not a cache eviction policy so much as a guard against unbounded growth under a distributed
   * flood. Dropping a partly-used bucket forgives a caller a few requests, which is the harmless
   * direction to be wrong in.
   */
  public void evictBuckets() {
    int size = buckets.size();
    buckets.clear();
    if (size > 0) {
      log.debug("Cleared {} rate-limit bucket(s)", size);
    }
  }
}
