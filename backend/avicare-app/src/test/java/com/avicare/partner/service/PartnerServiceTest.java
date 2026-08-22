package com.avicare.partner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import com.avicare.partner.repository.PartnerRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartnerServiceTest {

  @Mock PartnerRepository partnerRepository;
  @Mock PartnerInviteCodeRepository inviteCodeRepository;
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
}
