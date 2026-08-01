package com.avicare.tenancy.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.security.principal.FarmRole;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.tenancy.domain.Farm;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.dto.request.CreateFarmRequest;
import com.avicare.tenancy.mapper.TenancyMapper;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/** Unit test for {@link FarmService}: repositories mocked, real MapStruct mapper. */
class FarmServiceTest {

  private FarmRepository farmRepository;
  private UserFarmRepository userFarmRepository;
  private ParametersFacade parametersFacade;
  private SubscriptionFacade subscriptionFacade;
  private FarmService farmService;

  @BeforeEach
  void setUp() {
    farmRepository = Mockito.mock(FarmRepository.class);
    userFarmRepository = Mockito.mock(UserFarmRepository.class);
    parametersFacade = Mockito.mock(ParametersFacade.class);
    subscriptionFacade = Mockito.mock(SubscriptionFacade.class);
    lenient()
        .when(parametersFacade.resolve(any(), any(), any(), any()))
        .thenReturn(Optional.empty());
    TenancyMapper mapper = Mappers.getMapper(TenancyMapper.class);
    farmService =
        new FarmService(
            farmRepository, userFarmRepository, mapper, parametersFacade, subscriptionFacade);
  }

  @Test
  void create_grantsCreatorOwnerMembership() {
    when(farmRepository.save(any(Farm.class)))
        .thenAnswer(
            inv -> {
              Farm f = inv.getArgument(0);
              f.setId(10L);
              return f;
            });

    farmService.create(
        7L, new CreateFarmRequest("Ferme A", null, null, null, null, null, null, null, null));

    ArgumentCaptor<UserFarm> captor = ArgumentCaptor.forClass(UserFarm.class);
    verify(userFarmRepository).save(captor.capture());
    UserFarm owner = captor.getValue();
    assertThat(owner.getUserId()).isEqualTo(7L);
    assertThat(owner.getFarmId()).isEqualTo(10L);
    assertThat(owner.getRole()).isEqualTo(FarmRole.OWNER);
    assertThat(owner.getPermissions())
        .containsExactlyElementsOf(FarmRole.OWNER.defaultPermissions());
  }

  @Test
  void create_appliesDefaultsAndOverrides() {
    when(farmRepository.save(any(Farm.class))).thenAnswer(inv -> inv.getArgument(0));

    farmService.create(
        1L, new CreateFarmRequest("F", null, null, null, null, null, "Europe/Paris", "EUR", null));

    ArgumentCaptor<Farm> captor = ArgumentCaptor.forClass(Farm.class);
    verify(farmRepository).save(captor.capture());
    Farm farm = captor.getValue();
    assertThat(farm.getTimezone()).isEqualTo("Europe/Paris");
    assertThat(farm.getCurrency()).isEqualTo("EUR");
    assertThat(farm.getCreatedBy()).isEqualTo(1L);
  }
}
