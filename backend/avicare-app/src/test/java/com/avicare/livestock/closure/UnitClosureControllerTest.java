package com.avicare.livestock.closure;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.access.FarmAccessChecker;
import com.avicare.common.security.config.SecurityConfig;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.common.tenancy.context.TenantData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Slice test for the closing endpoints' guards and status codes. Imports {@link SecurityConfig} so
 * {@code @EnableMethodSecurity} actually enforces the {@code @PreAuthorize} expressions.
 *
 * <p>{@code farmAccess} is mocked <b>by its SpEL name</b>: the annotation resolves the gate by bean
 * name, not by type. The gate's own logic lives in the common-security tests.
 */
@WebMvcTest(UnitClosureController.class)
@Import(SecurityConfig.class)
class UnitClosureControllerTest {

  @Autowired private MockMvc mockMvc;

  /** JwtFilter (a Filter @Component pulled in by the slice) needs JwtService to instantiate. */
  @MockitoBean private JwtService jwtService;

  /** The global audit interceptor is a WebMvcConfigurer, so every @WebMvcTest slice loads it. */
  @MockitoBean private com.avicare.admin.service.AdminAuditService adminAuditService;

  @MockitoBean private UnitClosureService unitClosureService;

  @MockitoBean(name = "farmAccess")
  private FarmAccessChecker farmAccess;

  private static final String BASE = "/api/v1/farms/7/production-units/42";

  /**
   * The tenancy context is a thread-local bound by the authentication filter, which a slice does
   * not run. Bind it by hand so the controller can attribute the closing to a user, and clear it so
   * the thread does not leak into the next test.
   */
  @BeforeEach
  void bindTenancy() {
    TenancyContext.set(new TenantData(3L, List.of(7L), false));
  }

  @AfterEach
  void clearTenancy() {
    TenancyContext.clear();
  }

  private void grantRead(boolean allowed) {
    when(farmAccess.hasPermission(anyLong(), anyString())).thenReturn(allowed);
  }

  private void grantSupervisor(boolean allowed) {
    when(farmAccess.hasRole(anyLong(), any(FarmRole[].class))).thenReturn(allowed);
  }

  private static UnitClosure closure() {
    UnitClosure c = new UnitClosure();
    c.setProductionUnitId(42L);
    c.setFarmId(7L);
    c.setClosedAt(LocalDateTime.now());
    c.setStartDate(LocalDate.now().minusDays(45));
    c.setEndDate(LocalDate.now());
    c.setDurationDays(45);
    c.setInitialCount(1000);
    c.setRemainingCount(180);
    c.setDeaths(20);
    c.setTotalCostXof(1_240_000L);
    c.setConsumedArticles(4);
    c.setValuedArticles(3);
    return c;
  }

  @Test
  @WithMockUser
  void close_returns201_forASupervisor() throws Exception {
    grantSupervisor(true);
    when(unitClosureService.close(anyLong(), anyLong(), any(), any(), any())).thenReturn(closure());

    mockMvc
        .perform(
            post(BASE + "/close")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"chickCostXof\":250000}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.deaths").value(20))
        .andExpect(jsonPath("$.data.valuationIncomplete").value(true));
  }

  @Test
  @WithMockUser
  void close_returns409_whenTheUnitIsAlreadyClosed() throws Exception {
    grantSupervisor(true);
    when(unitClosureService.close(anyLong(), anyLong(), any(), any(), any()))
        .thenThrow(new ConflictException("UNIT_ALREADY_CLOSED", "Unit 42 is already closed"));

    mockMvc
        .perform(
            post(BASE + "/close")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isConflict());
  }

  @Test
  @WithMockUser
  void close_returns403_forAFarmer() throws Exception {
    grantSupervisor(false); // FARMER holds poultry:write but no supervisory role

    mockMvc
        .perform(
            post(BASE + "/close")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isForbidden());

    verify(unitClosureService, never()).close(anyLong(), anyLong(), any(), any(), any());
  }

  @Test
  @WithMockUser
  void get_returns404_whenTheUnitIsStillOpen() throws Exception {
    grantRead(true);
    when(unitClosureService.get(7L, 42L)).thenThrow(NotFoundException.of("UnitClosure", 42L));

    mockMvc.perform(get(BASE + "/closure")).andExpect(status().isNotFound());
  }

  @Test
  @WithMockUser
  void get_returns403_withoutPoultryRead() throws Exception {
    grantRead(false);

    mockMvc.perform(get(BASE + "/closure")).andExpect(status().isForbidden());

    verify(unitClosureService, never()).get(anyLong(), anyLong());
  }

  @Test
  @WithMockUser
  void reopen_returns204_forASupervisor() throws Exception {
    grantSupervisor(true);

    mockMvc.perform(delete(BASE + "/closure").with(csrf())).andExpect(status().isNoContent());

    verify(unitClosureService).reopen(7L, 42L);
  }

  @Test
  @WithMockUser
  void reopen_returns404_whenNoReportExists() throws Exception {
    grantSupervisor(true);
    doThrow(NotFoundException.of("UnitClosure", 42L)).when(unitClosureService).reopen(7L, 42L);

    mockMvc.perform(delete(BASE + "/closure").with(csrf())).andExpect(status().isNotFound());
  }
}
