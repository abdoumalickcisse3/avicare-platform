package com.avicare.common.api.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads or generates an {@code X-Correlation-Id} for each HTTP request and puts it in the SLF4J MDC
 * so every log line emitted while processing the request carries the same id.
 *
 * <p>{@code X-Request-Id} is accepted as an inbound alias — it is what proxies and CDNs commonly
 * set — but the response always names it {@code X-Correlation-Id}, the one header the API contract,
 * the CORS policy and the {@code traceId} of every error response already speak of.
 *
 * <p>Runs at {@link Ordered#HIGHEST_PRECEDENCE} so the correlation id is available to every filter
 * downstream.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

  public static final String HEADER_NAME = "X-Correlation-Id";

  /** Inbound-only alias, for callers and proxies that name it this way. */
  public static final String HEADER_ALIAS = "X-Request-Id";

  public static final String MDC_KEY = "correlationId";

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {

    String correlationId =
        firstNonBlank(request.getHeader(HEADER_NAME), request.getHeader(HEADER_ALIAS));
    if (correlationId == null) {
      correlationId = UUID.randomUUID().toString();
    }

    MDC.put(MDC_KEY, correlationId);
    response.setHeader(HEADER_NAME, correlationId);

    try {
      chain.doFilter(request, response);
    } finally {
      MDC.remove(MDC_KEY);
    }
  }

  private static String firstNonBlank(String first, String second) {
    if (first != null && !first.isBlank()) {
      return first;
    }
    return second != null && !second.isBlank() ? second : null;
  }
}
