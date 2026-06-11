package com.avicare.common.security.config;

import com.avicare.common.api.error.ProblemDetailResponse;
import com.avicare.common.security.jwt.JwtFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Activates and configures Spring Security for the platform.
 *
 * <p>The chain is stateless (JWT only — no server session), CORS is opened for the local web/mobile
 * dev origins, CSRF is disabled (irrelevant without cookies-as-session), and {@link JwtFilter} runs
 * before {@link UsernamePasswordAuthenticationFilter} to authenticate from the bearer token.
 *
 * <p>{@code @EnableMethodSecurity} turns on {@code @PreAuthorize}, which is how controllers reach
 * the {@code @farmAccess} SpEL bean for tenant-level RBAC.
 *
 * <p>Authentication (401) and authorization (403) failures raised inside the filter chain never
 * reach the {@code @RestControllerAdvice} in {@code common-api}, so this config maps them to the
 * same RFC 7807 {@link ProblemDetailResponse} shape here, keeping every error response uniform.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

  private static final String ERROR_TYPE_BASE = "https://avicare.com/errors/";
  private static final String MDC_CORRELATION_ID = "correlationId";

  private final JwtFilter jwtFilter;
  private final ObjectMapper objectMapper;

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.disable())
        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(HttpMethod.OPTIONS, "/**")
                    .permitAll()
                    .requestMatchers("/actuator/health/**", "/actuator/info")
                    .permitAll()
                    .requestMatchers("/api/v1/auth/**")
                    .permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/v1/subscription/plans")
                    .permitAll()
                    .requestMatchers("/swagger-ui/**", "/v3/api-docs/**")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .exceptionHandling(
            ex ->
                ex.authenticationEntryPoint(authenticationEntryPoint())
                    .accessDeniedHandler(accessDeniedHandler()))
        .build();
  }

  /**
   * Prevents Spring Boot from also registering {@link JwtFilter} as a plain servlet filter. As a
   * {@code @Component} of type {@code Filter} it would otherwise run before the Spring Security
   * chain (and its {@code SecurityContextHolderFilter}), which resets the context and drops the
   * authentication we just set. The filter is wired exclusively through {@code addFilterBefore}
   * above.
   */
  @Bean
  public FilterRegistrationBean<JwtFilter> jwtFilterRegistration(JwtFilter filter) {
    FilterRegistrationBean<JwtFilter> registration = new FilterRegistrationBean<>(filter);
    registration.setEnabled(false);
    return registration;
  }

  /** Returns a uniform RFC 7807 401 when an unauthenticated user hits a protected route. */
  @Bean
  public AuthenticationEntryPoint authenticationEntryPoint() {
    return (request, response, authException) ->
        writeProblem(
            response,
            request,
            HttpServletResponse.SC_UNAUTHORIZED,
            "authentication-failed",
            "Authentication Failed",
            "AUTHENTICATION_FAILED",
            "Full authentication is required to access this resource");
  }

  /** Returns a uniform RFC 7807 403 when an authenticated user lacks the required permission. */
  @Bean
  public AccessDeniedHandler accessDeniedHandler() {
    return (request, response, accessDeniedException) ->
        writeProblem(
            response,
            request,
            HttpServletResponse.SC_FORBIDDEN,
            "access-denied",
            "Access Denied",
            "ACCESS_DENIED",
            "You do not have permission to access this resource");
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:3000", "http://localhost:19006"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setExposedHeaders(List.of("X-Correlation-Id"));
    config.setAllowCredentials(true);
    config.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }

  private void writeProblem(
      HttpServletResponse response,
      HttpServletRequest request,
      int status,
      String typeSlug,
      String title,
      String code,
      String detail)
      throws IOException {
    ProblemDetailResponse body =
        ProblemDetailResponse.builder()
            .type(URI.create(ERROR_TYPE_BASE + typeSlug))
            .title(title)
            .status(status)
            .detail(detail)
            .instance(URI.create(request.getRequestURI()))
            .code(code)
            .traceId(MDC.get(MDC_CORRELATION_ID))
            .build();

    response.setStatus(status);
    response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    objectMapper.writeValue(response.getWriter(), body);
  }
}
