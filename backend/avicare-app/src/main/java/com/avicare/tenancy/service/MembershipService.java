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
import java.util.Comparator;
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

  /**
   * The roster, revoked members included.
   *
   * <p>It deliberately does NOT filter on {@code active}. Removing a member only flips that flag,
   * and filtering here made the removal a one-way door: the row vanished from every screen, so
   * nothing could flip it back, and re-adding the same person failed on {@code
   * MEMBERSHIP_ALREADY_EXISTS} because the membership still existed. Access is revoked where it
   * belongs — {@code MembershipProviderImpl} reads {@code findByUserIdAndActiveTrue} — not by
   * hiding the row from the people who manage it.
   *
   * <p>Active members first, then alphabetically, so the roster does not reorder itself as people
   * come and go.
   */
  @Transactional(readOnly = true)
  public List<MemberResponse> listMembers(Long farmId) {
    return userFarmRepository.findByFarmId(farmId).stream()
        .map(this::toResponse)
        .sorted(
            Comparator.comparing(MemberResponse::active)
                .reversed()
                .thenComparing(MemberResponse::fullName, String.CASE_INSENSITIVE_ORDER))
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
