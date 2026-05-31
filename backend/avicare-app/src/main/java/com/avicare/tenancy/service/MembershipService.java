package com.avicare.tenancy.service;

import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.dto.request.AddMemberRequest;
import com.avicare.tenancy.dto.request.UpdateMemberRequest;
import com.avicare.tenancy.dto.response.MemberResponse;
import com.avicare.tenancy.mapper.TenancyMapper;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages farm memberships. Resolves invited users through the {@link IdentityFacade} (tenancy →
 * identity, per docs/03), so tenancy never touches identity internals.
 */
@Service
@RequiredArgsConstructor
public class MembershipService {

  private final UserFarmRepository userFarmRepository;
  private final IdentityFacade identityFacade;
  private final TenancyMapper tenancyMapper;

  @Transactional
  public MemberResponse addMember(Long farmId, AddMemberRequest request) {
    UserInfo user = identityFacade.findByEmail(request.email());
    if (userFarmRepository.existsByUserIdAndFarmId(user.id(), farmId)) {
      throw new ConflictException(
          "MEMBERSHIP_ALREADY_EXISTS", "User is already a member of this farm");
    }

    UserFarm membership = new UserFarm();
    membership.setUserId(user.id());
    membership.setFarmId(farmId);
    membership.setRole(request.role());
    membership.setPermissions(request.role().defaultPermissions());
    return tenancyMapper.toResponse(userFarmRepository.save(membership));
  }

  @Transactional(readOnly = true)
  public List<MemberResponse> listMembers(Long farmId) {
    return userFarmRepository.findByFarmIdAndIsActiveTrue(farmId).stream()
        .map(tenancyMapper::toResponse)
        .toList();
  }

  @Transactional
  public MemberResponse updateMember(Long farmId, Long userId, UpdateMemberRequest request) {
    UserFarm membership = load(farmId, userId);
    membership.setRole(request.role());
    membership.setPermissions(
        request.permissions() != null
            ? request.permissions()
            : request.role().defaultPermissions());
    return tenancyMapper.toResponse(membership);
  }

  /** Soft removal: deactivate the membership rather than hard-deleting the row. */
  @Transactional
  public void removeMember(Long farmId, Long userId) {
    UserFarm membership = load(farmId, userId);
    membership.setActive(false);
  }

  private UserFarm load(Long farmId, Long userId) {
    return userFarmRepository
        .findByUserIdAndFarmId(userId, farmId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "MEMBERSHIP_NOT_FOUND",
                    "No membership for user " + userId + " on farm " + farmId));
  }
}
