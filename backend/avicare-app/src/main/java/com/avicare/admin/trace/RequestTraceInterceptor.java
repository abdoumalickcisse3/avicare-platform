package com.avicare.admin.trace;

import com.avicare.common.security.principal.AvicarePrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Tells {@link RequestTraceFilter} who was behind the request and which farm it touched.
 *
 * <p>The filter cannot read this itself: it wraps the whole chain, and by the time control comes
 * back to it both the security context and the tenancy context have been cleared by their own
 * {@code finally} blocks. This interceptor runs inside the dispatch, where both still exist, and
 * parks the facts in request attributes — the same trick {@code AdminMutationAuditInterceptor} uses
 * for the farm id.
 *
 * <p>A support session is attributed to the staff member really behind it ({@code
 * effectiveActorId}), never to the farmer being impersonated.
 *
 * <p>Stateless and dependency-free, so it is instantiated where it is registered instead of being
 * component-scanned — one less bean for {@code @WebMvcTest} slices to have to know about.
 */
public class RequestTraceInterceptor implements HandlerInterceptor {

  private static final String ATTR_USER_ID = "avicare.trace.userId";
  private static final String ATTR_USER_EMAIL = "avicare.trace.userEmail";
  private static final String ATTR_FARM_ID = "avicare.trace.farmId";

  @Override
  public boolean preHandle(
      HttpServletRequest request, HttpServletResponse response, Object handler) {
    AvicarePrincipal principal = currentPrincipal();
    if (principal != null) {
      request.setAttribute(ATTR_USER_ID, principal.effectiveActorId());
      request.setAttribute(ATTR_USER_EMAIL, principal.email());
    }
    Long farmId = farmIdOf(request);
    if (farmId != null) {
      request.setAttribute(ATTR_FARM_ID, farmId);
    }
    return true;
  }

  static Long userId(HttpServletRequest request) {
    return (Long) request.getAttribute(ATTR_USER_ID);
  }

  static String userEmail(HttpServletRequest request) {
    return (String) request.getAttribute(ATTR_USER_EMAIL);
  }

  static Long farmId(HttpServletRequest request) {
    return (Long) request.getAttribute(ATTR_FARM_ID);
  }

  /** The mapped pattern ({@code /api/v1/farms/{farmId}}), stable across ids, when available. */
  static String routePattern(HttpServletRequest request) {
    Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
    return pattern instanceof String s ? s : null;
  }

  /**
   * The authenticated caller, read the way the rest of the platform reads it.
   *
   * <p>{@code JwtFilter} puts the {@code userId} in {@code getPrincipal()} and the full {@link
   * AvicarePrincipal} in {@code getDetails()} — the shape {@code FarmAccessChecker}, {@code
   * StaffAccessChecker} and {@code AdminMutationAuditInterceptor} all read. Looking in {@code
   * getPrincipal()} finds a {@code Long} and silently attributes every trace to nobody.
   */
  private static AvicarePrincipal currentPrincipal() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !authentication.isAuthenticated()) {
      return null;
    }
    return authentication.getDetails() instanceof AvicarePrincipal principal ? principal : null;
  }

  /** The farm a tenant-scoped call targeted, so a trace is searchable per tenant. */
  @SuppressWarnings("unchecked")
  private static Long farmIdOf(HttpServletRequest request) {
    Object vars = request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
    if (vars instanceof Map<?, ?> map) {
      Object farmId = ((Map<String, String>) map).get("farmId");
      if (farmId != null) {
        try {
          return Long.valueOf(farmId.toString());
        } catch (NumberFormatException ignored) {
          return null;
        }
      }
    }
    return null;
  }
}
