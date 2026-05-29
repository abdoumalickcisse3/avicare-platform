package com.avicare.common.security.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.avicare.common.security.jwt.JwtFilter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.InsufficientAuthenticationException;

/**
 * Unit tests for the RFC 7807 entry point / access-denied handler beans. The full {@link
 * org.springframework.security.web.SecurityFilterChain} wiring (public vs protected routes) is
 * exercised by the integration test in the {@code avicare-app} module.
 */
class SecurityConfigTest {

  // Mirrors the Spring Boot auto-configured ObjectMapper (JSR-310 module registered) so the
  // ProblemDetailResponse#timestamp (Instant) serializes the same way it does at runtime.
  private final ObjectMapper objectMapper = Jackson2ObjectMapperBuilder.json().build();
  private final SecurityConfig config = new SecurityConfig(mock(JwtFilter.class), objectMapper);

  @Test
  void authenticationEntryPoint_writesRfc7807Unauthorized() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/batches");
    MockHttpServletResponse response = new MockHttpServletResponse();

    config
        .authenticationEntryPoint()
        .commence(request, response, new InsufficientAuthenticationException("no token"));

    assertThat(response.getStatus()).isEqualTo(401);
    assertThat(response.getContentType()).isEqualTo(MediaType.APPLICATION_PROBLEM_JSON_VALUE);

    JsonNode body = objectMapper.readTree(response.getContentAsString());
    assertThat(body.get("status").asInt()).isEqualTo(401);
    assertThat(body.get("code").asText()).isEqualTo("AUTHENTICATION_FAILED");
    assertThat(body.get("title").asText()).isEqualTo("Authentication Failed");
    assertThat(body.get("type").asText()).isEqualTo("https://avicare.com/errors/authentication-failed");
    assertThat(body.get("instance").asText()).isEqualTo("/api/v1/batches");
  }

  @Test
  void accessDeniedHandler_writesRfc7807Forbidden() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/batches");
    MockHttpServletResponse response = new MockHttpServletResponse();

    config
        .accessDeniedHandler()
        .handle(request, response, new AccessDeniedException("denied"));

    assertThat(response.getStatus()).isEqualTo(403);
    assertThat(response.getContentType()).isEqualTo(MediaType.APPLICATION_PROBLEM_JSON_VALUE);

    JsonNode body = objectMapper.readTree(response.getContentAsString());
    assertThat(body.get("status").asInt()).isEqualTo(403);
    assertThat(body.get("code").asText()).isEqualTo("ACCESS_DENIED");
    assertThat(body.get("title").asText()).isEqualTo("Access Denied");
    assertThat(body.get("type").asText()).isEqualTo("https://avicare.com/errors/access-denied");
  }

  @Test
  void corsConfigurationSource_allowsLocalDevOrigins() {
    var source = config.corsConfigurationSource();
    var request = new MockHttpServletRequest("GET", "/api/v1/batches");

    var cors = source.getCorsConfiguration(request);

    assertThat(cors).isNotNull();
    assertThat(cors.getAllowedOrigins())
        .containsExactlyInAnyOrder("http://localhost:3000", "http://localhost:19006");
    assertThat(cors.getAllowCredentials()).isTrue();
    assertThat(cors.getExposedHeaders()).contains("X-Correlation-Id");
  }
}
