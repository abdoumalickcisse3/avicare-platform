package com.avicare.common.security.jwt;

import com.avicare.common.security.exception.TokenValidationException;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.common.tenancy.context.TenantData;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates every request from its {@code Authorization: Bearer <jwt>} header.
 *
 * <p>On a valid access token the filter populates two stores for the duration of the request:
 *
 * <ul>
 *   <li>{@link SecurityContextHolder} — an {@link UsernamePasswordAuthenticationToken} whose
 *       principal is the {@code userId} ({@code Long}) and whose {@code details} is the full {@link
 *       AvicarePrincipal} (the shape {@code FarmAccessChecker} reads).
 *   <li>{@link TenancyContext} — a {@link TenantData} so the tenant-scoping helpers can resolve the
 *       user's accessible farms without re-parsing the token.
 * </ul>
 *
 * <p>Both stores are {@code ThreadLocal}-backed and are <b>always</b> cleared in a {@code finally}
 * block: Tomcat recycles worker threads, so a missing cleanup would leak one user's identity into
 * the next request served by the same thread.
 *
 * <p>A missing, malformed or invalid token is <b>not</b> rejected here — the filter simply leaves
 * the contexts empty and lets the chain proceed. Authorization then fails downstream:
 * {@code SecurityConfig}'s {@code anyRequest().authenticated()} returns 401 for protected routes,
 * while public routes still work. This keeps the filter's single responsibility to "authenticate if
 * possible".
 *
 * <p>This filter runs inside the Spring Security chain only — {@code SecurityConfig} places it via
 * {@code addFilterBefore(..., UsernamePasswordAuthenticationFilter.class)} and disables its
 * standalone servlet registration (a {@code FilterRegistrationBean} with {@code enabled=false}).
 * Registering it as a plain servlet filter as well would run it before Spring Security's
 * {@code SecurityContextHolderFilter}, which then resets the context and drops the authentication.
 *
 * <p>Cookie-based extraction (web httpOnly cookie, doc 05 §3.8) and the Redis {@code jti} blacklist
 * are deferred to Sprint A3, where the auth controller that issues those cookies/tokens lands.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtFilter extends OncePerRequestFilter {

  public static final String HEADER_NAME = "Authorization";
  public static final String BEARER_PREFIX = "Bearer ";

  private final JwtService jwtService;

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {

    String token = extractToken(request);

    if (token != null) {
      try {
        authenticate(jwtService.validateAccessToken(token));
      } catch (TokenValidationException e) {
        // Invalid/expired/wrong-type token: stay unauthenticated and let the
        // authorization layer return 401 on protected routes.
        log.warn("Rejected JWT: {}", e.getMessage());
      }
    }

    try {
      chain.doFilter(request, response);
    } finally {
      TenancyContext.clear();
      SecurityContextHolder.clearContext();
    }
  }

  /** Binds the principal to both the Spring security context and the tenancy context. */
  private void authenticate(AvicarePrincipal principal) {
    TenancyContext.set(
        new TenantData(principal.userId(), principal.accessibleFarmIds(), principal.isAdmin()));

    var auth =
        new UsernamePasswordAuthenticationToken(
            principal.userId(), null, buildAuthorities(principal));
    auth.setDetails(principal);
    SecurityContextHolder.getContext().setAuthentication(auth);

    log.debug("JWT authenticated userId={} role={}", principal.userId(), principal.role());
  }

  /** Reads the bearer token from the {@code Authorization} header, or {@code null} if absent. */
  private String extractToken(HttpServletRequest request) {
    String header = request.getHeader(HEADER_NAME);
    if (header != null && header.startsWith(BEARER_PREFIX)) {
      String token = header.substring(BEARER_PREFIX.length()).trim();
      return token.isEmpty() ? null : token;
    }
    return null;
  }

  private List<GrantedAuthority> buildAuthorities(AvicarePrincipal principal) {
    return List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().name()));
  }
}
