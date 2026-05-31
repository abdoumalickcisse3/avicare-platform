package com.avicare.tenancy.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.dto.request.AddMemberRequest;
import com.avicare.tenancy.mapper.TenancyMapper;
import com.avicare.tenancy.repository.UserFarmRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.mockito.Mockito;

/** Unit test for {@link MembershipService}: identity facade + repository mocked. */
class MembershipServiceTest {

  private UserFarmRepository userFarmRepository;
  private IdentityFacade identityFacade;
  private MembershipService membershipService;

  @BeforeEach
  void setUp() {
    userFarmRepository = Mockito.mock(UserFarmRepository.class);
    identityFacade = Mockito.mock(IdentityFacade.class);
    TenancyMapper mapper = Mappers.getMapper(TenancyMapper.class);
    membershipService = new MembershipService(userFarmRepository, identityFacade, mapper);
  }

  @Test
  void addMember_resolvesUserAndPersistsWithDefaultPermissions() {
    when(identityFacade.findByEmail("vet@avicare.io"))
        .thenReturn(new UserInfo(5L, "vet@avicare.io", "Vet", UserRole.USER, true));
    when(userFarmRepository.existsByUserIdAndFarmId(5L, 3L)).thenReturn(false);
    when(userFarmRepository.save(any(UserFarm.class))).thenAnswer(inv -> inv.getArgument(0));

    membershipService.addMember(3L, new AddMemberRequest("vet@avicare.io", FarmRole.VETERINARIAN));

    verify(userFarmRepository).save(any(UserFarm.class));
  }

  @Test
  void addMember_duplicate_throwsConflict() {
    when(identityFacade.findByEmail("dup@avicare.io"))
        .thenReturn(new UserInfo(5L, "dup@avicare.io", "Dup", UserRole.USER, true));
    when(userFarmRepository.existsByUserIdAndFarmId(5L, 3L)).thenReturn(true);

    assertThatThrownBy(
            () ->
                membershipService.addMember(
                    3L, new AddMemberRequest("dup@avicare.io", FarmRole.FARMER)))
        .isInstanceOf(ConflictException.class);

    verify(userFarmRepository, never()).save(any());
  }

  @Test
  void removeMember_deactivatesMembership() {
    UserFarm membership = new UserFarm();
    membership.setUserId(5L);
    membership.setFarmId(3L);
    membership.setRole(FarmRole.FARMER);
    membership.setActive(true);
    when(userFarmRepository.findByUserIdAndFarmId(5L, 3L))
        .thenReturn(java.util.Optional.of(membership));

    membershipService.removeMember(3L, 5L);

    assertThat(membership.isActive()).isFalse();
  }
}
