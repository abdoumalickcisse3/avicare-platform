package com.avicare.threat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.avicare.threat.filter.RateLimitFilter;
import com.avicare.threat.service.ThreatDetectionService;
import jakarta.servlet.ServletException;
import java.io.IOException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.ObjectMapper;

/**
 * The survey submission is the only write path on the platform that needs no token, so its ceiling
 * is a security control, not a tuning knob. Its results page is a different matter: it is read-only
 * and is meant to be shown to anyone, including a whole cooperative sharing one connection.
 */
class RateLimitFilterSurveyTest {

  private static final String OUTSIDE = "41.82.100.7";

  private final RateLimitFilter filter =
      new RateLimitFilter(mock(ThreatDetectionService.class), new ObjectMapper(), true);

  private int statusAfterCalling(String method, String uri) throws ServletException, IOException {
    MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
    request.addHeader("X-Forwarded-For", OUTSIDE);
    MockHttpServletResponse response = new MockHttpServletResponse();
    filter.doFilter(request, response, new MockFilterChain());
    return response.getStatus();
  }

  @Test
  @DisplayName("the sixth submission in an hour from one address is refused")
  void submissionsAreCappedPerHour() throws Exception {
    for (int i = 1; i <= 5; i++) {
      assertThat(statusAfterCalling("POST", "/api/v1/public/survey"))
          .as("submission %d should pass", i)
          .isEqualTo(200);
    }

    assertThat(statusAfterCalling("POST", "/api/v1/public/survey")).isEqualTo(429);
  }

  @Test
  @DisplayName("reading the results is not capped at the submission rate")
  void resultsPageIsNotThrottledLikeSubmissions() throws Exception {
    for (int i = 1; i <= 20; i++) {
      assertThat(statusAfterCalling("GET", "/api/v1/public/survey/results"))
          .as("read %d should pass", i)
          .isEqualTo(200);
    }
  }

  /**
   * A ceiling matched on the raw URI is a ceiling with a side door: a trailing slash, a path
   * parameter or a percent-encoded letter all reach the same controller while reading as a
   * different string. The cap is therefore decided on the normalised path.
   */
  @Test
  @DisplayName("a trailing slash does not buy a fresh allowance")
  void trailingSlashIsTheSameRoute() throws Exception {
    for (int i = 1; i <= 5; i++) {
      assertThat(statusAfterCalling("POST", "/api/v1/public/survey")).isEqualTo(200);
    }

    assertThat(statusAfterCalling("POST", "/api/v1/public/survey/")).isEqualTo(429);
  }

  @Test
  @DisplayName("a path parameter does not buy a fresh allowance")
  void pathParameterIsTheSameRoute() throws Exception {
    for (int i = 1; i <= 5; i++) {
      assertThat(statusAfterCalling("POST", "/api/v1/public/survey")).isEqualTo(200);
    }

    assertThat(statusAfterCalling("POST", "/api/v1/public/survey;jsessionid=0123456789"))
        .isEqualTo(429);
  }

  @Test
  @DisplayName("a percent-encoded letter does not buy a fresh allowance")
  void percentEncodingIsTheSameRoute() throws Exception {
    for (int i = 1; i <= 5; i++) {
      assertThat(statusAfterCalling("POST", "/api/v1/public/survey")).isEqualTo(200);
    }

    // %73 is 's' — "/api/v1/public/%73urvey"
    assertThat(statusAfterCalling("POST", "/api/v1/public/%73urvey")).isEqualTo(429);
  }
}
