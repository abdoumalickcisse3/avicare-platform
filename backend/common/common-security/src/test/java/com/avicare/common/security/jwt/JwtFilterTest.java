package com.avicare.common.security.jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.avicare.common.security.exception.ExpiredTokenException;
import com.avicare.common.security.exception.InvalidTokenException;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.Membership;
import com.avicare.common.security.principal.UserRole;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.common.tenancy.context.TenantData;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

class JwtFilterTest {

  private static final String VALID_TOKEN = "valid.jwt.token";

  private final JwtService jwtService = mock(JwtService.class);
  private final JwtFilter filter = new JwtFilter(jwtService);

  @AfterEach
  void cleanup() {
    SecurityContextHolder.clearContext();
    TenancyContext.clear();
  }

  @Test
  void validBearerToken_authenticatesWithUserIdPrincipalAndDetails() throws Exception {
    AvicarePrincipal principal =
        new AvicarePrincipal(
            7L,
            "user@avicare.com",
            UserRole.USER,
            List.of(new Membership(42L, FarmRole.FARMER, List.of("poultry:write"))));
    when(jwtService.validateAccessToken(VALID_TOKEN)).thenReturn(principal);

    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(JwtFilter.HEADER_NAME, JwtFilter.BEARER_PREFIX + VALID_TOKEN);

    CapturingChain chain = new CapturingChain();
    filter.doFilterInternal(request, new MockHttpServletResponse(), chain);

    Authentication auth = chain.authentication;
    assertThat(auth).isNotNull();
    assertThat(auth.isAuthenticated()).isTrue();
    assertThat(auth.getPrincipal()).isEqualTo(7L);
    assertThat(auth.getDetails()).isEqualTo(principal);
    assertThat(auth.getAuthorities()).extracting("authority").containsExactly("ROLE_USER");
  }

  @Test
  void validToken_populatesTenancyContext() throws Exception {
    AvicarePrincipal principal =
        new AvicarePrincipal(
            7L,
            "user@avicare.com",
            UserRole.USER,
            List.of(new Membership(42L, FarmRole.FARMER, List.of("poultry:write"))));
    when(jwtService.validateAccessToken(VALID_TOKEN)).thenReturn(principal);

    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(JwtFilter.HEADER_NAME, JwtFilter.BEARER_PREFIX + VALID_TOKEN);

    CapturingChain chain = new CapturingChain();
    filter.doFilterInternal(request, new MockHttpServletResponse(), chain);

    TenantData data = chain.tenantData;
    assertThat(data).isNotNull();
    assertThat(data.userId()).isEqualTo(7L);
    assertThat(data.accessibleFarmIds()).containsExactly(42L);
    assertThat(data.isSuperAdmin()).isFalse();
  }

  @Test
  void platformAdmin_setsSuperAdminFlagInTenancyContext() throws Exception {
    AvicarePrincipal admin =
        new AvicarePrincipal(1L, "admin@avicare.com", UserRole.ADMIN, List.of());
    when(jwtService.validateAccessToken(VALID_TOKEN)).thenReturn(admin);

    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(JwtFilter.HEADER_NAME, JwtFilter.BEARER_PREFIX + VALID_TOKEN);

    CapturingChain chain = new CapturingChain();
    filter.doFilterInternal(request, new MockHttpServletResponse(), chain);

    assertThat(chain.tenantData.isSuperAdmin()).isTrue();
    assertThat(chain.authentication.getAuthorities())
        .extracting("authority")
        .containsExactly("ROLE_ADMIN");
  }

  @Test
  void contextsAreClearedAfterRequest() throws Exception {
    AvicarePrincipal principal =
        new AvicarePrincipal(7L, "user@avicare.com", UserRole.USER, List.of());
    when(jwtService.validateAccessToken(VALID_TOKEN)).thenReturn(principal);

    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(JwtFilter.HEADER_NAME, JwtFilter.BEARER_PREFIX + VALID_TOKEN);

    filter.doFilterInternal(request, new MockHttpServletResponse(), new CapturingChain());

    // ThreadLocal leakage guard: both stores must be empty once the filter returns.
    assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    assertThat(TenancyContext.isSet()).isFalse();
  }

  @Test
  void missingHeader_leavesContextsEmptyAndProceeds() throws Exception {
    CapturingChain chain = new CapturingChain();
    filter.doFilterInternal(new MockHttpServletRequest(), new MockHttpServletResponse(), chain);

    assertThat(chain.called).isTrue();
    assertThat(chain.authentication).isNull();
    assertThat(chain.tenantData).isNull();
    verifyNoInteractions(jwtService);
  }

  @Test
  void invalidToken_leavesContextsEmptyAndProceeds() throws Exception {
    when(jwtService.validateAccessToken(VALID_TOKEN))
        .thenThrow(new InvalidTokenException("bad signature", null));

    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(JwtFilter.HEADER_NAME, JwtFilter.BEARER_PREFIX + VALID_TOKEN);

    CapturingChain chain = new CapturingChain();
    filter.doFilterInternal(request, new MockHttpServletResponse(), chain);

    assertThat(chain.called).isTrue();
    assertThat(chain.authentication).isNull();
    assertThat(chain.tenantData).isNull();
  }

  @Test
  void expiredToken_leavesContextsEmptyAndProceeds() throws Exception {
    when(jwtService.validateAccessToken(VALID_TOKEN))
        .thenThrow(new ExpiredTokenException(new RuntimeException("expired")));

    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(JwtFilter.HEADER_NAME, JwtFilter.BEARER_PREFIX + VALID_TOKEN);

    CapturingChain chain = new CapturingChain();
    filter.doFilterInternal(request, new MockHttpServletResponse(), chain);

    assertThat(chain.called).isTrue();
    assertThat(chain.authentication).isNull();
  }

  @Test
  void malformedHeaderWithoutBearerPrefix_isIgnored() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(JwtFilter.HEADER_NAME, "Basic dXNlcjpwYXNz");

    CapturingChain chain = new CapturingChain();
    filter.doFilterInternal(request, new MockHttpServletResponse(), chain);

    assertThat(chain.called).isTrue();
    assertThat(chain.authentication).isNull();
    verify(jwtService, never()).validateAccessToken(anyString());
  }

  @Test
  void emptyBearerToken_isIgnored() throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.addHeader(JwtFilter.HEADER_NAME, JwtFilter.BEARER_PREFIX + "   ");

    CapturingChain chain = new CapturingChain();
    filter.doFilterInternal(request, new MockHttpServletResponse(), chain);

    assertThat(chain.called).isTrue();
    assertThat(chain.authentication).isNull();
    verifyNoInteractions(jwtService);
  }

  /**
   * Captures the security/tenancy state observed <i>during</i> the chain, because the filter clears
   * both contexts in its {@code finally} block once the chain returns.
   */
  private static final class CapturingChain implements FilterChain {
    private boolean called;
    private Authentication authentication;
    private TenantData tenantData;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response) {
      this.called = true;
      this.authentication = SecurityContextHolder.getContext().getAuthentication();
      this.tenantData = TenancyContext.tryGet().orElse(null);
    }
  }
}
