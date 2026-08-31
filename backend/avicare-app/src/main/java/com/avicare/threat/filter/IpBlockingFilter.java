package com.avicare.threat.filter;

import com.avicare.common.api.web.ClientIp;
import com.avicare.threat.service.ThreatDetectionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Turns away addresses the platform is currently refusing.
 *
 * <p>Runs before authentication — the whole point is to spend nothing on a request from a script,
 * and checking credentials first would mean hashing a password for every attempt. It runs after the
 * request tracer, though, so a refused request still leaves a trace: "why can't I log in" is a
 * support call, and the answer has to be findable.
 *
 * <p>Health checks are exempt. A blocked address must never be able to make the platform look down
 * to its own monitoring.
 */
@RequiredArgsConstructor
public class IpBlockingFilter extends OncePerRequestFilter {

  private final ThreatDetectionService threatDetection;
  private final ObjectMapper objectMapper;

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return request.getRequestURI().startsWith("/actuator");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String ip = ClientIp.of(request);
    if (threatDetection.isBlocked(ip)) {
      ProblemWriter.write(
          objectMapper,
          request,
          response,
          HttpServletResponse.SC_FORBIDDEN,
          "address-blocked",
          "Address Blocked",
          "ADDRESS_BLOCKED",
          "Trop de tentatives depuis cette adresse. Réessayez plus tard.");
      return;
    }
    chain.doFilter(request, response);
  }
}
