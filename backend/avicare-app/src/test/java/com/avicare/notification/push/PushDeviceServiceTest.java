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

  /** One statement covers both a new token and a phone handed to another account. */
  @Test
  void register_upsertsTheTokenForTheCaller() {
    service().register(10L, "ExponentPushToken[a]", PushPlatform.IOS);

    verify(repo).upsert(10L, "ExponentPushToken[a]", "IOS");
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
