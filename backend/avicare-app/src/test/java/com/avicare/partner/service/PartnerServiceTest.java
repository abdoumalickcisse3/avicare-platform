package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.domain.PartnerStatus;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import com.avicare.partner.repository.PartnerRepository;
import com.avicare.partner.repository.PartnerUserRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class PartnerServiceTest {

  @Mock PartnerRepository partnerRepository;
  @Mock PartnerInviteCodeRepository inviteCodeRepository;
  @Mock PartnerUserRepository partnerUserRepository;
  @Spy PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);
  @InjectMocks PartnerService service;

  @Test
  void createPersistsActivePartnerWithActor() {
    when(partnerRepository.save(any(Partner.class))).thenAnswer(inv -> inv.getArgument(0));

    Partner p =
        service.create(
            "Provendier X", PartnerType.FEED_SUPPLIER, "Awa", "770000000", null, null, 7L);

    assertThat(p.getName()).isEqualTo("Provendier X");
    assertThat(p.getType()).isEqualTo(PartnerType.FEED_SUPPLIER);
    assertThat(p.getCreatedBy()).isEqualTo(7L);
  }

  @Test
  void generateInviteCodeProducesUniqueUppercaseCode() {
    when(inviteCodeRepository.findByCode(any())).thenReturn(Optional.empty());
    when(inviteCodeRepository.save(any(PartnerInviteCode.class)))
        .thenAnswer(inv -> inv.getArgument(0));
    when(partnerRepository.findById(3L)).thenReturn(Optional.of(new Partner()));

    PartnerInviteCode code = service.generateInviteCode(3L, 50, null, 7L);

    assertThat(code.getPartnerId()).isEqualTo(3L);
    assertThat(code.getCode()).hasSize(8).matches("[A-Z0-9]{8}");
    assertThat(code.getMaxUses()).isEqualTo(50);
    assertThat(code.isActive()).isTrue();
  }

  @Test
  void listActiveFiltersByStatusAndType() {
    Partner active = new Partner();
    active.setName("Provendier X");
    active.setType(PartnerType.FEED_SUPPLIER);
    active.setStatus(PartnerStatus.ACTIVE);
    when(partnerRepository.findByStatus(PartnerStatus.ACTIVE)).thenReturn(List.of(active));

    assertThat(service.listActive(null)).containsExactly(active);
    assertThat(service.listActive(PartnerType.FEED_SUPPLIER)).containsExactly(active);
    assertThat(service.listActive(PartnerType.VET)).isEmpty();
  }

  @Test
  void mapByIdsIndexesPartnersById() {
    Partner p = new Partner();
    p.setName("Provendier X");
    p.setType(PartnerType.FEED_SUPPLIER);
    when(partnerRepository.findAllById(List.of(3L))).thenReturn(List.of(withId(p, 3L)));

    Map<Long, Partner> byId = service.mapByIds(List.of(3L));

    assertThat(byId).containsOnlyKeys(3L);
    assertThat(byId.get(3L).getName()).isEqualTo("Provendier X");
  }

  @Test
  void createPartnerUserHashesPasswordAndReturnsTempOnce() {
    when(partnerRepository.findById(3L)).thenReturn(Optional.of(new Partner()));
    when(partnerUserRepository.save(any(com.avicare.partner.domain.PartnerUser.class)))
        .thenAnswer(inv -> inv.getArgument(0));

    var result = service.createPartnerUser(3L, "p@x.io", "Awa");

    assertThat(result.user().getEmail()).isEqualTo("p@x.io");
    assertThat(result.user().getPartnerId()).isEqualTo(3L);
    assertThat(result.temporaryPassword()).hasSizeGreaterThanOrEqualTo(10);
    assertThat(result.user().getPasswordHash()).isNotEqualTo(result.temporaryPassword());
    assertThat(passwordEncoder.matches(result.temporaryPassword(), result.user().getPasswordHash()))
        .isTrue();
  }

  /** Test helper: Partner#id has no setter; set it via the JPA field for assertions. */
  private static Partner withId(Partner p, long id) {
    try {
      var f = Partner.class.getDeclaredField("id");
      f.setAccessible(true);
      f.set(p, id);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException(e);
    }
    return p;
  }
}
