package com.avicare.threat.filter;

import com.avicare.common.api.error.ProblemDetailResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import org.slf4j.MDC;
import org.springframework.http.MediaType;

/**
 * Writes a refusal in the same RFC 7807 shape as the rest of the API.
 *
 * <p>These two filters run before Spring MVC, so the {@code @RestControllerAdvice} never sees them.
 * A client that has to parse one error format for controllers and another for filters will get it
 * wrong, and the {@code traceId} is what makes a refusal findable in {@code /console/traces}.
 *
 * <p>The charset is set explicitly. Outside the MVC stack nothing has negotiated one, so the
 * container falls back to ISO-8859-1 and the farmer reads "R?essayez" — these messages are in
 * French, and a refusal that looks corrupted reads like a broken app rather than a deliberate one.
 */
final class ProblemWriter {

  private static final String TYPE_BASE = "https://avicare.com/errors/";

  private ProblemWriter() {}

  static void write(
      ObjectMapper objectMapper,
      HttpServletRequest request,
      HttpServletResponse response,
      int status,
      String slug,
      String title,
      String code,
      String detail)
      throws IOException {
    ProblemDetailResponse body =
        ProblemDetailResponse.builder()
            .type(URI.create(TYPE_BASE + slug))
            .title(title)
            .status(status)
            .detail(detail)
            .instance(URI.create(request.getRequestURI()))
            .code(code)
            .traceId(MDC.get("correlationId"))
            .build();

    response.setStatus(status);
    response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    response.setCharacterEncoding(java.nio.charset.StandardCharsets.UTF_8.name());
    objectMapper.writeValue(response.getWriter(), body);
  }
}
