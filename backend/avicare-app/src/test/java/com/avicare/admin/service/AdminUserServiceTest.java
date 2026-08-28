package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.repository.UserRepository;
import com.avicare.identity.service.RefreshTokenService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminUserServiceTest {

  @Mock UserRepository userRepository;
  @Mock IdentityFacade identityFacade;
  @Mock RefreshTokenService refreshTokenService;
  @Mock AdminAuditService auditService;

  private AdminUserService service() {
    return new AdminUserService(userRepository, identityFacade, refreshTokenService, auditService);
  }

  @Test
  void searchesNothingOnAnEmptyQuery() {
    // An empty search must not dump every account on the platform.
    assertThat(service().search("  ")).isEmpty();
    assertThat(service().search(null)).isEmpty();
    verify(userRepository, never()).search(anyString(), any());
  }

  @Test
  void resetRevokesTheSessionsToo() {
    service().resetPassword(7L);

    verify(identityFacade).resetPassword(eq(7L), anyString());
    // The old password is gone; a session still holding a refresh token must go with it.
    verify(refreshTokenService).revokeAllForUser(7L);
    verify(auditService).record(eq("user.password.reset"), eq("User"), eq(7L), any(), any());
  }

  @Test
  void resetReturnsTheTemporaryPasswordOnce() {
    var response = service().resetPassword(7L);

    assertThat(response.temporaryPassword()).isNotBlank();
    assertThat(response.userId()).isEqualTo(7L);
  }

  @Test
  void deactivatingRevokesEverySession() {
    service().setActive(7L, false);

    verify(identityFacade).setActive(7L, false);
    // Without this the account keeps working until its access token expires — the exact window
    // that matters when disabling in a hurry.
    verify(refreshTokenService).revokeAllForUser(7L);
    verify(auditService).record(eq("user.deactivate"), eq("User"), eq(7L), any(), any());
  }

  @Test
  void reactivatingDoesNotRevokeAnything() {
    service().setActive(7L, true);

    verify(identityFacade).setActive(7L, true);
    verify(refreshTokenService, never()).revokeAllForUser(any());
    verify(auditService).record(eq("user.activate"), eq("User"), eq(7L), any(), any());
  }

  @Test
  void searchTrimsTheQuery() {
    when(userRepository.search(eq("modou"), any())).thenReturn(List.of());

    service().search("  modou  ");

    verify(userRepository).search(eq("modou"), any());
  }
}
