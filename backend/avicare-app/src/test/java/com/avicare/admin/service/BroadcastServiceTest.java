package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BroadcastServiceTest {

  @Mock FarmRepository farms;
  @Mock UserFarmRepository memberships;
  @Mock UserRepository users;
  @Mock WhatsAppOutboxFacade outbox;
  @Mock AdminAuditService auditService;

  @InjectMocks BroadcastService service;

  private void member(Long farmId, Long userId, String phone, boolean active) {
    UserFarm membership = new UserFarm();
    membership.setUserId(userId);
    membership.setFarmId(farmId);
    List<UserFarm> current =
        new java.util.ArrayList<>(memberships.findByFarmIdAndActiveTrue(farmId));
    current.add(membership);
    when(memberships.findByFarmIdAndActiveTrue(farmId)).thenReturn(current);

    User user = new User();
    user.setId(userId);
    user.setPhone(phone);
    user.setActive(active);
    when(users.findById(userId)).thenReturn(Optional.of(user));
  }

  @Test
  void countsEachPersonOnceEvenAcrossSeveralFarms() {
    member(1L, 7L, "770000001", true);
    member(2L, 7L, "770000001", true);
    member(2L, 8L, "770000002", true);

    Map<String, Long> recipients = service.recipients(List.of(1L, 2L));

    // One person managing three farms is one person; three copies is how a campaign becomes spam.
    assertThat(recipients).hasSize(2);
    // Attributed to the first farm that reached them.
    assertThat(recipients).containsEntry("770000001", 1L);
  }

  @Test
  void skipsAccountsWithNoNumberAndDisabledOnes() {
    member(1L, 7L, null, true);
    member(1L, 8L, "  ", true);
    member(1L, 9L, "770000003", false);

    assertThat(service.recipients(List.of(1L))).isEmpty();
  }

  @Test
  void anEmptyFarmListMeansEveryFarm() {
    when(farms.findAllIds()).thenReturn(List.of(1L, 2L));
    member(1L, 7L, "770000001", true);
    member(2L, 8L, "770000002", true);

    assertThat(service.recipients(List.of())).hasSize(2);
    assertThat(service.recipients(null)).hasSize(2);
    // One code path, so the count shown and the recipients reached cannot disagree.
    verify(farms, times(2)).findAllIds();
  }

  @Test
  void queuesOneMessagePerRecipientAttributedToTheirFarm() {
    member(1L, 7L, "770000001", true);

    int queued = service.send("Maintenance samedi", List.of(1L));

    assertThat(queued).isEqualTo(1);
    verify(outbox).enqueueBroadcast(eq("770000001"), eq("Maintenance samedi"), eq(1L));
  }

  @Test
  void keepsTheCampaignTextInTheAuditTrail() {
    member(1L, 7L, "770000001", true);

    service.send("Coupure prévue", List.of(1L));

    ArgumentCaptor<Map<String, Object>> metadata = ArgumentCaptor.captor();
    verify(auditService).record(anyString(), anyString(), any(), any(), metadata.capture());
    // A campaign nobody can read back is one nobody can be held to.
    assertThat(metadata.getValue())
        .containsEntry("message", "Coupure prévue")
        .containsEntry("recipients", 1);
  }

  @Test
  void sendsNothingWhenNobodyIsReachable() {
    when(farms.findAllIds()).thenReturn(List.of(1L));

    assertThat(service.send("Bonjour", null)).isZero();
    verify(outbox, never()).enqueueBroadcast(anyString(), anyString(), anyLong());
  }
}
