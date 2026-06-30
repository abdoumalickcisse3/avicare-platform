package com.avicare.tenancy.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.api.dto.ProvisionUserCommand;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.dto.request.CreateMemberRequest;
import com.avicare.tenancy.dto.response.CreateMemberResult;
import com.avicare.tenancy.repository.UserFarmRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
    membershipService = new MembershipService(userFarmRepository, identityFacade);
  }

  @Test
  void createMemberAccount_provisionsUserAndPersistsMembership() {
    UserInfo provisioned =
        new UserInfo(5L, "worker@avicare.io", "Worker Name", null, UserRole.USER, true);
    when(identityFacade.provisionUser(any(ProvisionUserCommand.class))).thenReturn(provisioned);
    when(userFarmRepository.existsByUserIdAndFarmId(5L, 3L)).thenReturn(false);
    when(userFarmRepository.save(any(UserFarm.class)))
        .thenAnswer(
            inv -> {
              UserFarm m = inv.getArgument(0);
              m.setUserId(5L);
              return m;
            });
    when(identityFacade.findById(5L)).thenReturn(provisioned);

    CreateMemberRequest req =
        new CreateMemberRequest("Worker Name", "worker@avicare.io", null, FarmRole.FARMER, null);
    CreateMemberResult result = membershipService.createMemberAccount(3L, req);

    verify(userFarmRepository).save(any(UserFarm.class));
    assertThat(result.temporaryPassword()).isNotBlank();
    assertThat(result.member().email()).isEqualTo("worker@avicare.io");
  }

  @Test
  void createMemberAccount_ownerRole_throwsBusinessRule() {
    CreateMemberRequest req =
        new CreateMemberRequest("Boss", "boss@avicare.io", null, FarmRole.OWNER, null);

    assertThatThrownBy(() -> membershipService.createMemberAccount(3L, req))
        .isInstanceOf(BusinessRuleException.class);

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
