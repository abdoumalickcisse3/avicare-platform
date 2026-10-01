package com.avicare.notification.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PushDeviceServiceTest {

  @Mock PushDeviceRepository repo;

  private PushDeviceService service() {
    return new PushDeviceService(repo);
  }

  private PushDevice existing(long userId, LocalDateTime revokedAt) {
    PushDevice d = new PushDevice();
    d.setUserId(userId);
    d.setToken("ExponentPushToken[a]");
    d.setPlatform(PushPlatform.IOS);
    d.setRevokedAt(revokedAt);
    return d;
  }

  @Test
  void register_createsADeviceForANewToken() {
    when(repo.findByToken("ExponentPushToken[a]")).thenReturn(Optional.empty());

    service().register(10L, "ExponentPushToken[a]", PushPlatform.IOS);

    ArgumentCaptor<PushDevice> saved = ArgumentCaptor.forClass(PushDevice.class);
    verify(repo).save(saved.capture());
    assertThat(saved.getValue().getUserId()).isEqualTo(10L);
    assertThat(saved.getValue().getToken()).isEqualTo("ExponentPushToken[a]");
    assertThat(saved.getValue().getPlatform()).isEqualTo(PushPlatform.IOS);
    assertThat(saved.getValue().getRevokedAt()).isNull();
  }

  /** A phone handed to another account must stop ringing for the previous owner. */
  @Test
  void register_movesAnExistingTokenToTheNewOwnerAndReactivatesIt() {
    PushDevice d = existing(99L, LocalDateTime.now().minusDays(1));
    when(repo.findByToken("ExponentPushToken[a]")).thenReturn(Optional.of(d));

    service().register(10L, "ExponentPushToken[a]", PushPlatform.IOS);

    assertThat(d.getUserId()).isEqualTo(10L);
    assertThat(d.getRevokedAt()).isNull();
    assertThat(d.getLastSeenAt()).isNotNull();
    verify(repo).save(d);
  }

  @Test
  void unregister_revokesATokenTheUserOwns() {
    PushDevice d = existing(10L, null);
    when(repo.findByToken("ExponentPushToken[a]")).thenReturn(Optional.of(d));

    service().unregister(10L, "ExponentPushToken[a]");

    assertThat(d.getRevokedAt()).isNotNull();
    verify(repo).save(d);
  }

  /** Logging out on one account must not silence somebody else's phone. */
  @Test
  void unregister_ignoresATokenOwnedBySomeoneElse() {
    PushDevice d = existing(99L, null);
    when(repo.findByToken("ExponentPushToken[a]")).thenReturn(Optional.of(d));

    service().unregister(10L, "ExponentPushToken[a]");

    assertThat(d.getRevokedAt()).isNull();
    verify(repo, never()).save(any());
  }

  @Test
  void activeTokensOf_listsTheTokensOfActiveDevices() {
    when(repo.findByUserIdInAndRevokedAtIsNull(List.of(10L)))
        .thenReturn(List.of(existing(10L, null)));

    assertThat(service().activeTokensOf(List.of(10L))).containsExactly("ExponentPushToken[a]");
  }

  @Test
  void activeTokensOf_noUsers_doesNotQuery() {
    assertThat(service().activeTokensOf(List.of())).isEmpty();
    verify(repo, never()).findByUserIdInAndRevokedAtIsNull(any());
  }

  @Test
  void revoke_stampsEveryNamedToken() {
    PushDevice d = existing(10L, null);
    when(repo.findByTokenIn(List.of("ExponentPushToken[a]"))).thenReturn(List.of(d));

    service().revoke(List.of("ExponentPushToken[a]"));

    assertThat(d.getRevokedAt()).isNotNull();
    verify(repo).saveAll(List.of(d));
  }
}
