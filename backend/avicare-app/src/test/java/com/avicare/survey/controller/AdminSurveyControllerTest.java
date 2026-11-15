package com.avicare.survey.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.security.config.SecurityConfig;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.survey.domain.FlockType;
import com.avicare.survey.dto.SurveyIntake;
import com.avicare.survey.service.SurveyAdminService;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The survey answers carry phone numbers of people who are not customers, so the only thing this
 * slice has to prove is that nothing comes out without {@code survey:read} — and that the gate is
 * that permission and not merely "is staff".
 */
@WebMvcTest(AdminSurveyController.class)
@Import(SecurityConfig.class)
class AdminSurveyControllerTest {

  @Autowired private MockMvc mockMvc;

  /** JwtFilter (a Filter @Component pulled in by the slice) needs JwtService to instantiate. */
  @MockitoBean private JwtService jwtService;

  /** The global audit interceptor is a WebMvcConfigurer, so every @WebMvcTest slice loads it. */
  @MockitoBean private com.avicare.admin.service.AdminAuditService adminAuditService;

  @MockitoBean private SurveyAdminService survey;

  /** Mocked under its SpEL name: @PreAuthorize looks the gate up by bean name, not by type. */
  @MockitoBean(name = "adminAccess")
  private com.avicare.admin.access.StaffAccessChecker adminAccess;

  private void grant(boolean allowed) {
    when(adminAccess.can(anyString())).thenReturn(allowed);
  }

  private static Page<com.avicare.survey.dto.SurveyAnswerRow> emptyPage() {
    return new PageImpl<>(List.of(), PageRequest.of(0, 50), 0);
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  @DisplayName("the summary needs survey:read")
  void intakeNeedsThePermission() throws Exception {
    grant(false);
    mockMvc.perform(get("/api/v1/admin/survey/intake")).andExpect(status().isForbidden());

    grant(true);
    when(survey.intake())
        .thenReturn(new SurveyIntake(0, 0, 0, null, 5, List.of(), List.of(), List.of()));
    mockMvc
        .perform(get("/api/v1/admin/survey/intake"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.publicationFloor").value(5));
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  @DisplayName("the answers need survey:read — being staff is not enough")
  void answersNeedThePermission() throws Exception {
    grant(false);
    mockMvc.perform(get("/api/v1/admin/survey/answers")).andExpect(status().isForbidden());

    grant(true);
    when(survey.search(isNull(), isNull(), isNull(), anyBoolean(), any())).thenReturn(emptyPage());
    mockMvc
        .perform(get("/api/v1/admin/survey/answers"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items").isArray());
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  @DisplayName("an empty filter is no filter, not a search for the empty string")
  void blankFiltersBecomeNull() throws Exception {
    grant(true);
    when(survey.search(isNull(), isNull(), isNull(), eq(false), any())).thenReturn(emptyPage());

    mockMvc
        .perform(get("/api/v1/admin/survey/answers").param("country", "").param("region", "   "))
        .andExpect(status().isOk());
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  @DisplayName("the filters reach the service, and an oversized page is capped")
  void filtersReachTheServiceAndSizeIsCapped() throws Exception {
    grant(true);
    when(survey.search(
            eq("CI"), eq("Abidjan"), eq(FlockType.LAYER), eq(true), eq(PageRequest.of(0, 200))))
        .thenReturn(emptyPage());

    mockMvc
        .perform(
            get("/api/v1/admin/survey/answers")
                .param("country", "CI")
                .param("region", "Abidjan")
                .param("flockType", "LAYER")
                .param("interviewOnly", "true")
                .param("size", "5000"))
        .andExpect(status().isOk());
  }
}
