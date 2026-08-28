package com.avicare.admin.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.UserRole;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerMapping;

@ExtendWith(MockitoExtension.class)
class AdminMutationAuditInterceptorTest {

  private static final Long STAFF_ID = 42L;

  @Mock AdminAuditService auditService;

  @AfterEach
  void clearAuth() {
    SecurityContextHolder.clearContext();
  }

  private void authenticate(Long userId, UserRole role) {
    AvicarePrincipal principal = new AvicarePrincipal(userId, "u@jawdi.app", role, List.of());
    var auth = new UsernamePasswordAuthenticationToken(principal.email(), null, List.of());
    auth.setDetails(principal);
    SecurityContextHolder.getContext().setAuthentication(auth);
  }

  private MockHttpServletRequest request(String method, String uri, String pattern, String farmId) {
    MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
    request.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, pattern);
    if (farmId != null) {
      request.setAttribute(
          HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE, Map.of("farmId", farmId));
    }
    return request;
  }

  private void run(MockHttpServletRequest request, int status) {
    MockHttpServletResponse response = new MockHttpServletResponse();
    response.setStatus(status);
    new AdminMutationAuditInterceptor(auditService)
        .afterCompletion(request, response, new Object(), null);
  }

  @Test
  void tracesAStaffMutationOnTheORDINARYTenantApi() {
    // The reason this interceptor exists: ADMIN bypasses FarmAccessChecker, so a staff member can
    // write any farm without ever touching /api/v1/admin/**.
    authenticate(STAFF_ID, UserRole.ADMIN);

    run(request("PATCH", "/api/v1/farms/8", "/api/v1/farms/{farmId}", "8"), 200);

    ArgumentCaptor<Map<String, Object>> metadata = ArgumentCaptor.captor();
    verify(auditService)
        .record(
            org.mockito.ArgumentMatchers.eq(STAFF_ID),
            org.mockito.ArgumentMatchers.eq("staff.patch /api/v1/farms/{farmId}"),
            anyString(),
            org.mockito.ArgumentMatchers.isNull(),
            org.mockito.ArgumentMatchers.eq(8L),
            metadata.capture());
    assertThat(metadata.getValue()).containsEntry("status", 200).containsEntry("method", "PATCH");
  }

  @Test
  void tracesARefusedAttemptToo() {
    authenticate(STAFF_ID, UserRole.ADMIN);

    run(request("DELETE", "/api/v1/farms/8", "/api/v1/farms/{farmId}", "8"), 403);

    ArgumentCaptor<Map<String, Object>> metadata = ArgumentCaptor.captor();
    verify(auditService)
        .record(anyLong(), anyString(), anyString(), any(), anyLong(), metadata.capture());
    // A denied attempt is as worth tracing as a successful one.
    assertThat(metadata.getValue()).containsEntry("status", 403);
  }

  @Test
  void ignoresReads() {
    authenticate(STAFF_ID, UserRole.ADMIN);

    run(request("GET", "/api/v1/farms/8", "/api/v1/farms/{farmId}", "8"), 200);

    verify(auditService, never()).record(anyLong(), anyString(), any(), any(), any(), any());
  }

  @Test
  void ignoresOrdinaryUsers() {
    authenticate(7L, UserRole.USER);

    run(request("POST", "/api/v1/farms/8/sales", "/api/v1/farms/{farmId}/sales", "8"), 201);

    verify(auditService, never()).record(anyLong(), anyString(), any(), any(), any(), any());
  }

  @Test
  void ignoresAnonymousRequests() {
    run(request("POST", "/api/v1/auth/login", "/api/v1/auth/login", null), 200);

    verify(auditService, never()).record(anyLong(), anyString(), any(), any(), any(), any());
  }

  @Test
  void tracesWithoutATenantWhenThePathCarriesNoFarm() {
    authenticate(STAFF_ID, UserRole.ADMIN);

    run(request("POST", "/api/v1/admin/partners", "/api/v1/admin/partners", null), 201);

    verify(auditService)
        .record(
            org.mockito.ArgumentMatchers.eq(STAFF_ID),
            anyString(),
            anyString(),
            org.mockito.ArgumentMatchers.isNull(),
            org.mockito.ArgumentMatchers.isNull(),
            any());
  }
}
