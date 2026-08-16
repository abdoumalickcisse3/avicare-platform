package com.avicare.tenancy.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.mapper.TenancyMapper;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TenancyFacadeMembersTest {

  @Mock FarmRepository farmRepository;
  @Mock UserFarmRepository userFarmRepository;
  @Mock TenancyMapper tenancyMapper;
  @InjectMocks TenancyFacadeImpl facade;

  @Test
  void listAllFarmIds_delegatesToRepository() {
    when(farmRepository.findAllIds()).thenReturn(List.of(1L, 2L, 3L));
    assertThat(facade.listAllFarmIds()).containsExactly(1L, 2L, 3L);
  }

  @Test
  void listMemberUserIds_returnsActiveMemberUserIds() {
    when(userFarmRepository.findByFarmIdAndActiveTrue(7L))
        .thenReturn(List.of(member(11L), member(12L)));
    assertThat(facade.listMemberUserIds(7L)).containsExactly(11L, 12L);
  }

  private static UserFarm member(Long userId) {
    UserFarm uf = new UserFarm();
    uf.setUserId(userId);
    return uf;
  }
}
