package com.avicare.tenancy;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.security.jwt.JwtService;
import com.avicare.tenancy.controller.PermissionCatalogController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Slice test for {@link PermissionCatalogController}. The controller has no service dependencies so
 * a {@link WebMvcTest} slice is sufficient — no DB, no full Spring context.
 */
@WebMvcTest(PermissionCatalogController.class)
class PermissionCatalogControllerTest {

  @Autowired private MockMvc mockMvc;

  /** JwtFilter (picked up by @WebMvcTest as a Filter component) needs JwtService to instantiate. */
  @MockitoBean private JwtService jwtService;

  @Test
  @WithMockUser
  void returns_resources_and_role_defaults() throws Exception {
    mockMvc
        .perform(get("/api/v1/permissions/catalog"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.resources[0].resource").value("poultry"))
        .andExpect(jsonPath("$.data.roleDefaults.MANAGER").isArray());
  }
}
