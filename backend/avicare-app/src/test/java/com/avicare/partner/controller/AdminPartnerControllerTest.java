package com.avicare.partner.controller;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.security.config.SecurityConfig;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerStatus;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.service.PartnerNetworkService;
import com.avicare.partner.service.PartnerService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Slice test for {@link AdminPartnerController}'s staff gate. Imports {@link SecurityConfig} so
 * {@code @EnableMethodSecurity} enforces the per-method
 * {@code @PreAuthorize("@adminAccess.can(…)")}.
 *
 * <p>The gate bean is mocked <b>by its SpEL name</b> so the slice verifies the wiring — that the
 * annotation resolves to the bean and that a refusal becomes a 403. The gate's own logic
 * (wildcards, staff marker, fail-closed) is covered by {@code StaffAccessCheckerTest}.
 */
@WebMvcTest(AdminPartnerController.class)
@Import(SecurityConfig.class)
class AdminPartnerControllerTest {

  @Autowired private MockMvc mockMvc;

  /** JwtFilter (a Filter @Component pulled in by the slice) needs JwtService to instantiate. */
  @MockitoBean private JwtService jwtService;

  @MockitoBean private PartnerService partnerService;

  /** The global audit interceptor is a WebMvcConfigurer, so every @WebMvcTest slice loads it. */
  @MockitoBean private com.avicare.admin.service.AdminAuditService adminAuditService;

  @MockitoBean private PartnerNetworkService partnerNetworkService;

  /** Mocked under its SpEL name: @PreAuthorize looks the gate up by bean name, not by type. */
  @MockitoBean(name = "adminAccess")
  private com.avicare.admin.access.StaffAccessChecker adminAccess;

  private void grant(boolean allowed) {
    when(adminAccess.can(org.mockito.ArgumentMatchers.anyString())).thenReturn(allowed);
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void listPartnersReturns200WithTheReadPermission() throws Exception {
    grant(true);
    when(partnerService.list()).thenReturn(List.of());

    mockMvc.perform(get("/api/v1/admin/partners")).andExpect(status().isOk());
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void listPartnersReturns403WithoutThePermission() throws Exception {
    // Being platform staff is no longer enough on its own: the permission decides.
    grant(false);

    mockMvc.perform(get("/api/v1/admin/partners")).andExpect(status().isForbidden());
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void patchSetsTheLogoWithoutTouchingTheOmittedFields() throws Exception {
    grant(true);
    Partner updated = new Partner();
    updated.setId(3L);
    updated.setName("Provende du Sahel");
    updated.setType(PartnerType.FEED_SUPPLIER);
    updated.setContactPhone("770000001");
    updated.setLogoUrl("https://cdn.example/sahel.png");
    updated.setStatus(PartnerStatus.ACTIVE);
    // The service receives nulls for everything the caller omitted.
    when(partnerService.update(3L, null, null, null, null, "https://cdn.example/sahel.png"))
        .thenReturn(updated);

    mockMvc
        .perform(
            patch("/api/v1/admin/partners/3")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"logoUrl\":\"https://cdn.example/sahel.png\"}")
                .with(csrf()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.logoUrl").value("https://cdn.example/sahel.png"))
        .andExpect(jsonPath("$.data.contactPhone").value("770000001"));
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void patchReturns403WithoutThePermission() throws Exception {
    grant(false);
    mockMvc
        .perform(
            patch("/api/v1/admin/partners/3")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"logoUrl\":\"https://cdn.example/x.png\"}")
                .with(csrf()))
        .andExpect(status().isForbidden());
  }
}
