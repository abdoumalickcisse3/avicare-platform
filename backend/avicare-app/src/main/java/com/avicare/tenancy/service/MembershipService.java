package com.avicare.tenancy.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.access.PermissionValidator;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.util.TemporaryPasswordGenerator;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.api.dto.ProvisionUserCommand;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.dto.request.CreateMemberRequest;
import com.avicare.tenancy.dto.request.UpdateMemberRequest;
import com.avicare.tenancy.dto.response.CreateMemberResult;
import com.avicare.tenancy.dto.response.MemberResponse;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages farm memberships. Resolves identity via {@link IdentityFacade} (tenancy → identity, per
 * docs/03), so tenancy never touches identity internals.
 */
@Service
@RequiredArgsConstructor
public class MembershipService {

  private final UserFarmRepository userFarmRepository;
  private final IdentityFacade identityFacade;

  /** Enriches a membership row with identity fields via {@link IdentityFacade}. */
  private MemberResponse toResponse(UserFarm m) {
    UserInfo u = identityFacade.findById(m.getUserId());
    return new MemberResponse(
        m.getId(),
        m.getUserId(),
        m.getFarmId(),
        u.fullName(),
        u.email(),
        u.phone(),
        m.getRole(),
        m.getPermissions(),
        m.isActive());
  }

  @Transactional
  public CreateMemberResult createMemberAccount(Long farmId, CreateMemberRequest request) {
    if (request.role() == FarmRole.OWNER) {
      throw new BusinessRuleException(
          "OWNER_NOT_ASSIGNABLE", "The OWNER role cannot be assigned to a member");
    }
    PermissionValidator.validate(request.permissions());
    String tempPassword = TemporaryPasswordGenerator.generate();
    UserInfo user =
        identityFacade.provisionUser(
            new ProvisionUserCommand(
                request.fullName(), request.email(), request.phone(), tempPassword));

    if (userFarmRepository.existsByUserIdAndFarmId(user.id(), farmId)) {
      throw new ConflictException(
          "MEMBERSHIP_ALREADY_EXISTS", "User is already a member of this farm");
    }

    UserFarm membership = new UserFarm();
    membership.setUserId(user.id());
    membership.setFarmId(farmId);
    membership.setRole(request.role());
    membership.setPermissions(
        request.permissions() != null
            ? request.permissions()
            : request.role().defaultPermissions());
    UserFarm saved = userFarmRepository.save(membership);
    return new CreateMemberResult(toResponse(saved), tempPassword);
  }

  @Transactional
  public String resetMemberPassword(Long farmId, Long userId) {
    UserFarm membership = load(farmId, userId);
    String tempPassword = TemporaryPasswordGenerator.generate();
    identityFacade.resetPassword(membership.getUserId(), tempPassword);
    return tempPassword;
  }

  @Transactional(readOnly = true)
  public List<MemberResponse> listMembers(Long farmId) {
    return userFarmRepository.findByFarmIdAndActiveTrue(farmId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public MemberResponse updateMember(Long farmId, Long userId, UpdateMemberRequest request) {
    if (request.role() == FarmRole.OWNER) {
      throw new BusinessRuleException(
          "OWNER_NOT_ASSIGNABLE", "The OWNER role cannot be assigned to a member");
    }
    UserFarm membership = load(farmId, userId);
    membership.setRole(request.role());
    membership.setPermissions(
        request.permissions() != null
            ? request.permissions()
            : request.role().defaultPermissions());
    PermissionValidator.validate(request.permissions());
    if (request.active() != null) membership.setActive(request.active());
    return toResponse(membership);
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
