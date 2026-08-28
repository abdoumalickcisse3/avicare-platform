package com.avicare.admin.audit;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.common.security.principal.AvicarePrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/**
 * Records every mutating request made by platform staff, <b>whatever the path</b>.
 *
 * <p>This exists because {@code FarmAccessChecker} grants any {@code ADMIN} principal access to
 * every farm ("Platform admins bypass every check"), and {@code FeatureChecker} does the same on
 * module gating. A staff account can therefore read and write any farm through the ordinary tenant
 * API, without ever touching {@code /api/v1/admin/**}. Auditing only the admin endpoints would make
 * the spec's invariant — every super-admin action is traced — false by construction, and would give
 * the console an assurance it does not have.
 *
 * <p>It also covers support sessions: an impersonation token carries {@code role=USER}, so the
 * actor is read from {@code effectiveActorId()} and the entry names the farmer being acted as.
 *
 * <p>Runs {@code afterCompletion} so the recorded status reflects what actually happened: a refused
 * or failed attempt is as worth tracing as a successful one. Explicit {@link AdminAuditService}
 * calls in the admin endpoints stay on top of this, because a generic "PATCH /api/v1/farms/{id}" is
 * a poor substitute for "farm.module.enable" with its metadata.
 */
@Component
@RequiredArgsConstructor
public class AdminMutationAuditInterceptor implements HandlerInterceptor {

  private static final Set<String> READ_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");

  private final AdminAuditService auditService;

  @Override
  public void afterCompletion(
      HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
    if (READ_METHODS.contains(request.getMethod())) {
      return;
    }
    AvicarePrincipal principal = currentPrincipal();
    // Staff acting as themselves, OR staff acting as a farmer: a support token carries role=USER,
    // so checking isAdmin alone would leave every action taken during a support session untraced —
    // exactly the ones that most need a trail.
    if (principal == null || (!principal.isAdmin() && !principal.isImpersonation())) {
      return;
    }

    String pattern = pathPattern(request);
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("method", request.getMethod());
    metadata.put("path", request.getRequestURI());
    metadata.put("status", response.getStatus());
    if (principal.isImpersonation()) {
      // Otherwise the entry would read as the farmer's own action.
      metadata.put("impersonating", principal.userId());
    }

    auditService.record(
        principal.effectiveActorId(),
        "staff." + request.getMethod().toLowerCase() + " " + pattern,
        "HttpRequest",
        null,
        farmIdOf(request),
        metadata);
  }

  /** The mapped pattern (stable across ids) when available, else the raw URI. */
  private static String pathPattern(HttpServletRequest request) {
    Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
    return pattern instanceof String s ? s : request.getRequestURI();
  }

  /** The farm a tenant-scoped call targeted, so the trail is readable per tenant. */
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

  private static AvicarePrincipal currentPrincipal() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) {
      return null;
    }
    return auth.getDetails() instanceof AvicarePrincipal principal ? principal : null;
  }
}
