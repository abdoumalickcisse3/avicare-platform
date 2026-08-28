package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.domain.PartnerUser;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import com.avicare.partner.repository.PartnerRepository;
import com.avicare.partner.repository.PartnerUserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

/** The back-office actions on partner accounts and invite codes. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PartnerServiceAdminActionsTest {

  private static final Long PARTNER_USER_ID = 5L;

  @Mock PartnerRepository partnerRepository;
  @Mock PartnerInviteCodeRepository inviteCodeRepository;
  @Mock PartnerUserRepository partnerUserRepository;
  @Mock PasswordEncoder passwordEncoder;
  @Mock PartnerRefreshTokenService refreshTokenService;

  private PartnerService service() {
    return new PartnerService(
        partnerRepository,
        inviteCodeRepository,
        partnerUserRepository,
        passwordEncoder,
        refreshTokenService);
  }

  private PartnerUser existingUser(boolean active) {
    PartnerUser u = new PartnerUser();
    u.setId(PARTNER_USER_ID);
    u.setPartnerId(2L);
    u.setEmail("sahel@partner.test");
    u.setPasswordHash("old-hash");
    u.setActive(active);
    when(partnerUserRepository.findById(PARTNER_USER_ID)).thenReturn(Optional.of(u));
    return u;
  }

  @Test
  void deactivatingRevokesEverySession() {
    PartnerUser user = existingUser(true);

    service().setPartnerUserActive(PARTNER_USER_ID, false);

    assertThat(user.isActive()).isFalse();
    // Otherwise a salesperson who left the feed supplier keeps their access to farmer data until
    // the refresh token expires.
    verify(refreshTokenService).revokeAllForPartnerUser(PARTNER_USER_ID);
  }

  @Test
  void reactivatingRevokesNothing() {
    PartnerUser user = existingUser(false);

    service().setPartnerUserActive(PARTNER_USER_ID, true);

    assertThat(user.isActive()).isTrue();
    verify(refreshTokenService, never()).revokeAllForPartnerUser(PARTNER_USER_ID);
  }

  @Test
  void resettingIssuesANewPasswordAndDropsTheSessions() {
    PartnerUser user = existingUser(true);
    when(passwordEncoder.encode(anyString())).thenReturn("new-hash");

    String temporary = service().resetPartnerUserPassword(PARTNER_USER_ID);

    assertThat(temporary).isNotBlank();
    assertThat(user.getPasswordHash()).isEqualTo("new-hash");
    // Sessions opened with the old password must not outlive it.
    verify(refreshTokenService).revokeAllForPartnerUser(PARTNER_USER_ID);
  }

  @Test
  void refusesToActOnAnUnknownAccount() {
    when(partnerUserRepository.findById(99L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().setPartnerUserActive(99L, false))
        .isInstanceOf(NotFoundException.class);
    assertThatThrownBy(() -> service().resetPartnerUserPassword(99L))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void revokingACodeKeepsTheRow() {
    PartnerInviteCode code = new PartnerInviteCode();
    code.setId(3L);
    code.setActive(true);
    when(inviteCodeRepository.findById(3L)).thenReturn(Optional.of(code));
    when(inviteCodeRepository.save(code)).thenReturn(code);

    assertThat(service().revokeInviteCode(3L).isActive()).isFalse();
    // Deleted would erase the history; a code that circulated is worth remembering.
    verify(inviteCodeRepository).save(code);
    verify(inviteCodeRepository, never()).delete(code);
  }
}
