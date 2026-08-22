package com.avicare.partner.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.security.config.SecurityConfig;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.partner.service.PartnerNetworkService;
import com.avicare.partner.service.PartnerService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Slice test for {@link AdminPartnerController}'s ADMIN gate. Imports {@link SecurityConfig} so
 * {@code @EnableMethodSecurity} enforces {@code @PreAuthorize("hasRole('ADMIN')")}. The list
 * endpoint is used because it does not touch {@code TenancyContext} (which is only populated by a
 * real JWT via the filter). Services are mocked.
 */
@WebMvcTest(AdminPartnerController.class)
@Import(SecurityConfig.class)
class AdminPartnerControllerTest {

  @Autowired private MockMvc mockMvc;

  /** JwtFilter (a Filter @Component pulled in by the slice) needs JwtService to instantiate. */
  @MockitoBean private JwtService jwtService;

  @MockitoBean private PartnerService partnerService;
  @MockitoBean private PartnerNetworkService partnerNetworkService;

  @Test
  @WithMockUser(roles = "ADMIN")
  void listPartnersReturns200ForAdmin() throws Exception {
    when(partnerService.list()).thenReturn(List.of());

    mockMvc.perform(get("/api/v1/admin/partners")).andExpect(status().isOk());
  }

  @Test
  @WithMockUser(roles = "USER")
  void listPartnersReturns403ForNonAdmin() throws Exception {
    mockMvc.perform(get("/api/v1/admin/partners")).andExpect(status().isForbidden());
  }
}
