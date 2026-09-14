package com.avicare.identity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ForbiddenException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.tenancy.api.TenancyFacade;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Closing one's own account — App Store rule 5.1.1(v). */
@ExtendWith(MockitoExtension.class)
class AccountDeletionServiceTest {

  private static final Long USER_ID = 8L;
  private static final String PASSWORD = "Test1234!";

  @Mock private UserRepository users;
  @Mock private IdentityFacade identityFacade;
  @Mock private TenancyFacade tenancyFacade;
  @Mock private RefreshTokenService refreshTokenService;
  @Mock private PasswordEncoder passwordEncoder;

  @InjectMocks private AccountDeletionService service;

  private User user;

  @BeforeEach
  void setUp() {
    user = new User();
    user.setId(USER_ID);
    user.setEmail("complete@test.avicare");
    user.setPasswordHash("$2a$12$hash");
    user.setRole(UserRole.USER);
  }

  private void accountExistsWithGoodPassword() {
    when(users.findById(USER_ID)).thenReturn(Optional.of(user));
    when(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).thenReturn(true);
  }

  @Test
  @DisplayName("erases the owned farms, then anonymises the account and closes every session")
  void deletesOwnedFarmsThenAnonymises() {
    accountExistsWithGoodPassword();
    when(tenancyFacade.listOwnedFarmIds(USER_ID)).thenReturn(List.of(8L, 12L));

    service.deleteOwnAccount(USER_ID, PASSWORD);

    verify(tenancyFacade).purgeFarm(8L);
    verify(tenancyFacade).purgeFarm(12L);
    // The row survives: users(id) is referenced by 59 columns, 45 without ON DELETE.
    verify(identityFacade).anonymize(USER_ID);
    verify(refreshTokenService).revokeAllForUser(USER_ID);
  }

  @Test
  @DisplayName("an account that owns nothing takes no farm with it")
  void memberOnlyAccountLeavesFarmsAlone() {
    accountExistsWithGoodPassword();
    // Manager, field worker, vet: the farm was never theirs, so it stays whole for its owner.
    when(tenancyFacade.listOwnedFarmIds(USER_ID)).thenReturn(List.of());

    service.deleteOwnAccount(USER_ID, PASSWORD);

    verify(tenancyFacade, never()).purgeFarm(anyLong());
    verify(identityFacade).anonymize(USER_ID);
  }

  @Test
  @DisplayName("a wrong password destroys nothing")
  void wrongPasswordDestroysNothing() {
    when(users.findById(USER_ID)).thenReturn(Optional.of(user));
    when(passwordEncoder.matches("pas-le-bon", user.getPasswordHash())).thenReturn(false);

    assertThatThrownBy(() -> service.deleteOwnAccount(USER_ID, "pas-le-bon"))
        .isInstanceOf(ForbiddenException.class)
        .hasMessageContaining("Mot de passe incorrect");

    // A session token is enough to browse; it is not enough to destroy. A phone left unlocked on
    // a table is the ordinary case here, not the exotic one.
    verify(tenancyFacade, never()).purgeFarm(anyLong());
    verify(identityFacade, never()).anonymize(anyLong());
    verify(refreshTokenService, never()).revokeAllForUser(anyLong());
  }

  @Test
  @DisplayName("a staff account cannot be closed from the app")
  void staffAccountIsRefused() {
    user.setRole(UserRole.ADMIN);
    accountExistsWithGoodPassword();

    assertThatThrownBy(() -> service.deleteOwnAccount(USER_ID, PASSWORD))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("accès console");

    verify(tenancyFacade, never()).purgeFarm(anyLong());
    verify(identityFacade, never()).anonymize(anyLong());
  }

  @Test
  @DisplayName("the password is checked before the role, so neither leaks the other")
  void passwordCheckedBeforeRole() {
    user.setRole(UserRole.ADMIN);
    when(users.findById(USER_ID)).thenReturn(Optional.of(user));
    when(passwordEncoder.matches(anyString(), any())).thenReturn(false);

    // Answering "this is a staff account" to a wrong password would confirm the account exists
    // and say what kind it is.
    assertThatThrownBy(() -> service.deleteOwnAccount(USER_ID, "pas-le-bon"))
        .isInstanceOf(ForbiddenException.class);
  }

  @Test
  @DisplayName("an unknown account is a 404, not a silent success")
  void unknownAccount() {
    when(users.findById(USER_ID)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.deleteOwnAccount(USER_ID, PASSWORD))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  @DisplayName("the preview counts the farms that would disappear")
  void previewCountsOwnedFarms() {
    when(tenancyFacade.listOwnedFarmIds(USER_ID)).thenReturn(List.of(8L, 12L, 15L));

    assertThat(service.preview(USER_ID).ownedFarmCount()).isEqualTo(3);
  }
}
