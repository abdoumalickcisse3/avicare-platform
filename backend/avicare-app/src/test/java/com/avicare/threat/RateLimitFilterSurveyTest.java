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
}
