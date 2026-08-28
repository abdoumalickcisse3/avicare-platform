package com.avicare.admin.bootstrap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.admin.domain.StaffPermission;
import com.avicare.admin.repository.StaffPermissionRepository;
import com.avicare.admin.service.AdminAuditService;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import java.util.Optional;
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
class FounderAdminInitializerTest {

  private static final String EMAIL = "founder@jawdi.app";

  @Mock UserRepository userRepository;
  @Mock StaffPermissionRepository staffPermissions;
  @Mock AdminAuditService auditService;

  private FounderAdminInitializer initializer(String email) {
    FounderAdminInitializer init =
        new FounderAdminInitializer(userRepository, staffPermissions, auditService);
    ReflectionTestUtils.setField(init, "founderEmail", email);
    return init;
  }

  private User user(Long id, UserRole role) {
    User u = new User();
    u.setId(id);
    u.setEmail(EMAIL);
    u.setRole(role);
    return u;
  }

  @Test
  void promotesAnExistingUserAndGrantsTheWildcard() {
    User founder = user(7L, UserRole.USER);
    when(userRepository.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(founder));
    when(staffPermissions.existsByUserIdAndPermission(7L, "*")).thenReturn(false);

    initializer(EMAIL).run(null);

    assertThat(founder.getRole()).isEqualTo(UserRole.ADMIN);
    ArgumentCaptor<StaffPermission> granted = ArgumentCaptor.captor();
    verify(staffPermissions).save(granted.capture());
    assertThat(granted.getValue().getPermission()).isEqualTo("*");
    // The one action nobody else could hold the founder to.
    verify(auditService).record(anyLong(), anyString(), anyString(), anyLong(), any(), any());
  }

  @Test
  void isIdempotentOnARestart() {
    when(userRepository.findByEmailIgnoreCase(EMAIL))
        .thenReturn(Optional.of(user(7L, UserRole.ADMIN)));
    when(staffPermissions.existsByUserIdAndPermission(7L, "*")).thenReturn(true);

    initializer(EMAIL).run(null);

    verify(staffPermissions, never()).save(any());
    verify(userRepository, never()).save(any());
    verify(auditService, never()).record(anyLong(), anyString(), any(), any(), any(), any());
  }

  @Test
  void restoresTheWildcardIfItWasDeleted() {
    // The lock-out safety net: an accidentally removed "*" comes back on the next restart.
    when(userRepository.findByEmailIgnoreCase(EMAIL))
        .thenReturn(Optional.of(user(7L, UserRole.ADMIN)));
    when(staffPermissions.existsByUserIdAndPermission(7L, "*")).thenReturn(false);

    initializer(EMAIL).run(null);

    verify(staffPermissions).save(any());
  }

  @Test
  void neverCreatesAnAccountForAnUnknownEmail() {
    when(userRepository.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.empty());

    assertThatCode(() -> initializer(EMAIL).run(null)).doesNotThrowAnyException();

    verify(userRepository, never()).save(any());
    verify(staffPermissions, never()).save(any());
  }

  @Test
  void doesNothingOnBlankConfiguration() {
    initializer("   ").run(null);

    verify(userRepository, never()).findByEmailIgnoreCase(anyString());
  }
}
