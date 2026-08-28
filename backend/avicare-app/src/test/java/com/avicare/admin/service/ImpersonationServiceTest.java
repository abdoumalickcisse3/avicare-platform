package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.identity.spi.MembershipProvider;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ImpersonationServiceTest {

  private static final Long STAFF = 42L;
  private static final Long FARMER = 7L;

  @Mock JwtService jwtService;
  @Mock IdentityFacade identityFacade;
  @Mock AdminAuditService auditService;

  private ImpersonationService service() {
    MembershipProvider memberships = userId -> List.of();
    ImpersonationService s =
        new ImpersonationService(jwtService, identityFacade, memberships, auditService);
    ReflectionTestUtils.setField(s, "ttl", Duration.ofMinutes(15));
    return s;
  }

  private void target(UserRole role, boolean active) {
    when(identityFacade.findById(FARMER))
        .thenReturn(new UserInfo(FARMER, "f@test.io", "Farmer", "77", role, active));
  }

  @Test
  void mintsATokenCarryingTheTargetIdentityNotTheStaffRole() {
    target(UserRole.USER, true);
    when(jwtService.generateImpersonationToken(any(), anyLong(), any())).thenReturn("tok");

    assertThat(service().open(STAFF, FARMER, "ticket 12")).isEqualTo("tok");

    ArgumentCaptor<AvicarePrincipal> principal = ArgumentCaptor.captor();
    verify(jwtService).generateImpersonationToken(principal.capture(), eq(STAFF), any());
    // The staff member must see what the farmer sees, missing permissions included.
    assertThat(principal.getValue().userId()).isEqualTo(FARMER);
    assertThat(principal.getValue().role()).isEqualTo(UserRole.USER);
    assertThat(principal.getValue().isAdmin()).isFalse();
  }

  @Test
  void auditsTheOpeningWithItsReason() {
    target(UserRole.USER, true);

    service().open(STAFF, FARMER, "ticket 12");

    verify(auditService)
        .record(eq(STAFF), eq("impersonation.open"), eq("User"), eq(FARMER), any(), any());
  }

  @Test
  void auditsTheClosing() {
    service().close(STAFF, FARMER);

    verify(auditService)
        .record(eq(STAFF), eq("impersonation.close"), eq("User"), eq(FARMER), any(), any());
  }

  @Test
  void refusesToImpersonateAnotherStaffAccount() {
    target(UserRole.ADMIN, true);

    // Lateral escalation: a support session reaches a farmer's view, never another staff
    // member's authority.
    assertThatThrownBy(() -> service().open(STAFF, FARMER, null))
        .isInstanceOf(ImpersonationService.ImpersonationRefusedException.class)
        .hasMessageContaining("staff");
    verify(jwtService, never()).generateImpersonationToken(any(), anyLong(), any());
    verify(auditService, never()).record(anyLong(), any(), any(), any(), any(), any());
  }

  @Test
  void refusesADisabledAccount() {
    target(UserRole.USER, false);

    assertThatThrownBy(() -> service().open(STAFF, FARMER, null))
        .isInstanceOf(ImpersonationService.ImpersonationRefusedException.class);
    verify(jwtService, never()).generateImpersonationToken(any(), anyLong(), any());
  }
}
