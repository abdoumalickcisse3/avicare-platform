package com.avicare.admin.trace;

import com.avicare.admin.trace.TracingProperties.Capture;
import com.avicare.common.api.error.GlobalExceptionHandler;
import com.avicare.common.api.filter.CorrelationIdFilter;
import com.avicare.common.api.web.ClientIp;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

/**
 * Records what happened to each HTTP request, so a support call ("I got an error this morning at
 * 10:37") becomes a search instead of a log hunt.
 *
 * <p>Sits just inside {@link CorrelationIdFilter} — the correlation id is already in the MDC and on
 * the response — and outside Spring Security, so the requests that never reach a controller (401,
 * 403, a rejected token) are traced too. They are precisely the ones a puzzled user calls about.
 *
 * <p><b>Bodies are buffered for writes only.</b> A {@link ContentCachingResponseWrapper} holds the
 * whole response in memory; paying that on every read, to keep a payload we discard whenever the
 * call succeeded, would be a poor trade. Reads are therefore traced without bodies: method, path,
 * status, duration, and — for a 5xx — the exception handed over by the global exception handler.
 *
 * <p>What is recorded at all is decided by {@link TracingProperties.Capture}; user, farm and route
 * come from {@link RequestTraceInterceptor}, which runs deeper in the chain where the security
 * context still exists.
 *
 * <p>Registered by {@link TracingConfig} rather than component-scanned: as a {@code @Component}
 * filter it would be pulled into every {@code @WebMvcTest} slice, which loads filters but no
 * services, and each slice would then have to mock a recorder it does not care about.
 */
@RequiredArgsConstructor
public class RequestTraceFilter extends OncePerRequestFilter {

  private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
  private static final Set<String> EXCLUDED_PREFIXES =
      Set.of("/actuator", "/swagger-ui", "/v3/api-docs", "/favicon.ico");

  private final RequestTraceRecorder recorder;
  private final TracingProperties properties;

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    if (!properties.enabled() || "OPTIONS".equals(request.getMethod())) {
      return true;
    }
    String path = request.getRequestURI();
    return EXCLUDED_PREFIXES.stream().anyMatch(path::startsWith);
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {

    boolean buffered = MUTATING_METHODS.contains(request.getMethod());
    ContentCachingRequestWrapper wrappedRequest =
        buffered ? new ContentCachingRequestWrapper(request) : null;
    ContentCachingResponseWrapper wrappedResponse =
        buffered ? new ContentCachingResponseWrapper(response) : null;

    LocalDateTime startedAt = LocalDateTime.now();
    long startNanos = System.nanoTime();
    Throwable failure = null;

    try {
      chain.doFilter(
          wrappedRequest != null ? wrappedRequest : request,
          wrappedResponse != null ? wrappedResponse : response);
    } catch (IOException | ServletException | RuntimeException e) {
      failure = e;
      throw e;
    } finally {
      int durationMs = (int) ((System.nanoTime() - startNanos) / 1_000_000);
      String requestBody =
          wrappedRequest == null ? null : body(wrappedRequest.getContentAsByteArray());
      String responseBody =
          wrappedResponse == null ? null : body(wrappedResponse.getContentAsByteArray());
      if (wrappedResponse != null) {
        // Mandatory: the cached bytes are otherwise never written to the real response.
        wrappedResponse.copyBodyToResponse();
      }

      int status = response.getStatus();
      if (shouldRecord(request, status, durationMs)) {
        Throwable error =
            failure != null
                ? failure
                : (Throwable) request.getAttribute(GlobalExceptionHandler.TRACE_ERROR_ATTRIBUTE);
        recorder.record(
            new RequestTraceDraft(
                MDC.get(CorrelationIdFilter.MDC_KEY),
                request.getMethod(),
                request.getRequestURI(),
                RequestTraceInterceptor.routePattern(request),
                RequestTraceInterceptor.userId(request),
                RequestTraceInterceptor.userEmail(request),
                RequestTraceInterceptor.farmId(request),
                status,
                durationMs,
                ClientIp.of(request),
                requestBody,
                request.getContentType(),
                status >= 400 ? responseBody : null,
                error,
                startedAt,
                LocalDateTime.now()));
      }
    }
  }

  /**
   * Everything that failed, everything that wrote, and the slow reads — see {@link
   * TracingProperties.Capture#ERRORS_AND_MUTATIONS}.
   */
  private boolean shouldRecord(HttpServletRequest request, int status, int durationMs) {
    if (properties.capture() == Capture.ALL) {
      return true;
    }
    return status >= 400
        || MUTATING_METHODS.contains(request.getMethod())
        || durationMs >= properties.slowMs();
  }

  private static String body(byte[] content) {
    return content.length == 0 ? null : new String(content, StandardCharsets.UTF_8);
  }
}
