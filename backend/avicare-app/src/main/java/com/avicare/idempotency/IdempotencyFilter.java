package com.avicare.idempotency;

import com.avicare.common.security.principal.AvicarePrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

/**
 * Makes a replayed write harmless.
 *
 * <p>A farmer's phone queues writes while offline and replays them later. When the connection dies
 * <em>after</em> the server wrote but <em>before</em> the answer came back, the phone cannot know
 * and replays — and a stock adjustment, an expense or a client would be created twice. The phone
 * therefore sends the queue entry's id as {@code Idempotency-Key}; the first request with a key
 * runs, and any later one with the same key gets that first answer back instead of running again.
 *
 * <p>Runs just inside Spring Security (the user is known, and a request refused for a stale token
 * is never claimed, so the phone's refresh-and-replay is unaffected). The key is scoped to the
 * user: one account can never read another's stored answer.
 *
 * <ul>
 *   <li>5xx answers and exceptions release the key — the failure says nothing about whether the
 *       write happened, and the client's retry must really run.
 *   <li>4xx answers are remembered: a replay of a rejected request would be rejected again.
 *   <li>A second request arriving while the first is still running gets 503 + {@code Retry-After},
 *       which the phone treats as retryable rather than as a rejected entry.
 * </ul>
 *
 * Registered by {@link IdempotencyConfig}, not component-scanned, to keep it out of web slices.
 */
public class IdempotencyFilter extends OncePerRequestFilter {

  public static final String HEADER = "Idempotency-Key";
  static final String REPLAYED_HEADER = "Idempotency-Replayed";

  private static final Set<String> MUTATING = Set.of("POST", "PUT", "PATCH", "DELETE");

  private final IdempotencyStore store;

  public IdempotencyFilter(IdempotencyStore store) {
    this.store = store;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !MUTATING.contains(request.getMethod())
        || request.getHeader(HEADER) == null
        || !store.available();
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    UUID key = parse(request.getHeader(HEADER));
    Long userId = currentUserId();
    if (key == null || userId == null) {
      chain.doFilter(request, response);
      return;
    }

    String method = request.getMethod();
    String path = request.getRequestURI();

    if (!store.claim(userId, key, method, path)) {
      IdempotencyStore.Entry existing = store.find(userId, key);
      if (existing != null
          && !existing.completed()
          && store.evictStale(userId, key)
          && store.claim(userId, key, method, path)) {
        existing = null;
      }
      if (existing != null) {
        answerFromStore(existing, method, path, response);
        return;
      }
    }

    ContentCachingResponseWrapper wrapped = new ContentCachingResponseWrapper(response);
    boolean finished = false;
    try {
      chain.doFilter(request, wrapped);
      finished = true;
    } finally {
      if (!finished) {
        store.release(userId, key);
      }
    }

    int status = wrapped.getStatus();
    if (status >= 500) {
      store.release(userId, key);
    } else {
      store.complete(
          userId,
          key,
          status,
          wrapped.getContentType(),
          new String(wrapped.getContentAsByteArray(), StandardCharsets.UTF_8));
    }
    wrapped.copyBodyToResponse();
  }

  private static void answerFromStore(
      IdempotencyStore.Entry entry, String method, String path, HttpServletResponse response)
      throws IOException {
    if (!entry.method().equals(method) || !entry.path().equals(path)) {
      response.setStatus(422);
      response.setContentType("application/problem+json");
      response
          .getWriter()
          .write(
              "{\"status\":422,\"code\":\"IDEMPOTENCY_KEY_REUSED\","
                  + "\"detail\":\"Idempotency-Key already used for a different request\"}");
      return;
    }
    if (!entry.completed()) {
      response.setStatus(503);
      response.setHeader("Retry-After", "5");
      return;
    }
    response.setStatus(entry.statusCode());
    if (entry.contentType() != null) {
      response.setContentType(entry.contentType());
    }
    response.setHeader(REPLAYED_HEADER, "true");
    if (entry.responseBody() != null) {
      response.getOutputStream().write(entry.responseBody().getBytes(StandardCharsets.UTF_8));
    }
  }

  private static UUID parse(String raw) {
    try {
      return UUID.fromString(raw.trim());
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  private static Long currentUserId() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !authentication.isAuthenticated()) {
      return null;
    }
    return authentication.getDetails() instanceof AvicarePrincipal principal
        ? principal.userId()
        : null;
  }
}
