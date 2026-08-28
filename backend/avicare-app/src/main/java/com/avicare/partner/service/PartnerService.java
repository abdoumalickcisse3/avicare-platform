package com.avicare.partner.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.util.TemporaryPasswordGenerator;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.domain.PartnerStatus;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.domain.PartnerUser;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import com.avicare.partner.repository.PartnerRepository;
import com.avicare.partner.repository.PartnerUserRepository;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Partner account lifecycle and invite-code generation (admin side). */
@Service
@RequiredArgsConstructor
public class PartnerService {

  private static final String CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  private static final int CODE_LENGTH = 8;
  private static final SecureRandom RANDOM = new SecureRandom();

  private final PartnerRepository partnerRepository;
  private final PartnerInviteCodeRepository inviteCodeRepository;
  private final PartnerUserRepository partnerUserRepository;
  private final PasswordEncoder passwordEncoder;
  private final PartnerRefreshTokenService refreshTokenService;

  @Transactional
  public Partner create(
      String name,
      PartnerType type,
      String contactName,
      String contactPhone,
      String contactEmail,
      String logoUrl,
      Long actorUserId) {
    Partner p = new Partner();
    p.setName(name);
    p.setType(type);
    p.setContactName(contactName);
    p.setContactPhone(contactPhone);
    p.setContactEmail(contactEmail);
    p.setLogoUrl(logoUrl);
    p.setStatus(PartnerStatus.ACTIVE);
    p.setCreatedBy(actorUserId);
    return partnerRepository.save(p);
  }

  /** Partial update: a null field leaves the stored value alone (PATCH semantics). */
  @Transactional
  public Partner update(
      Long partnerId,
      String name,
      String contactName,
      String contactPhone,
      String contactEmail,
      String logoUrl) {
    Partner p = get(partnerId);
    if (name != null) p.setName(name);
    if (contactName != null) p.setContactName(contactName);
    if (contactPhone != null) p.setContactPhone(contactPhone);
    if (contactEmail != null) p.setContactEmail(contactEmail);
    if (logoUrl != null) p.setLogoUrl(logoUrl);
    return partnerRepository.save(p);
  }

  @Transactional(readOnly = true)
  public List<Partner> list() {
    return partnerRepository.findAll();
  }

  /** Active partners for the farmer-facing directory, optionally filtered by type. */
  @Transactional(readOnly = true)
  public List<Partner> listActive(PartnerType type) {
    return partnerRepository.findByStatus(PartnerStatus.ACTIVE).stream()
        .filter(p -> type == null || p.getType() == type)
        .toList();
  }

  /** Batch resolution of partners by id (soft-deleted excluded by {@code @SQLRestriction}). */
  @Transactional(readOnly = true)
  public Map<Long, Partner> mapByIds(Collection<Long> ids) {
    return partnerRepository.findAllById(ids).stream()
        .collect(Collectors.toMap(Partner::getId, Function.identity()));
  }

  @Transactional(readOnly = true)
  public Partner get(Long partnerId) {
    return partnerRepository
        .findById(partnerId)
        .orElseThrow(() -> NotFoundException.of("Partner", partnerId));
  }

  @Transactional
  public Partner setStatus(Long partnerId, PartnerStatus status) {
    Partner p = get(partnerId);
    p.setStatus(status);
    return partnerRepository.save(p);
  }

  @Transactional
  public PartnerInviteCode generateInviteCode(
      Long partnerId, Integer maxUses, LocalDateTime expiresAt, Long actorUserId) {
    get(partnerId); // 404 if the partner does not exist
    PartnerInviteCode code = new PartnerInviteCode();
    code.setPartnerId(partnerId);
    code.setCode(uniqueCode());
    code.setActive(true);
    code.setMaxUses(maxUses);
    code.setExpiresAt(expiresAt);
    code.setCreatedBy(actorUserId);
    return inviteCodeRepository.save(code);
  }

  /** Result of provisioning a partner user: the saved entity + the temporary password (once). */
  public record PartnerUserResult(PartnerUser user, String temporaryPassword) {}

  /** ADMIN provisions a partner-portal login. Returns the temp password once (BCrypt hashed). */
  @Transactional
  public PartnerUserResult createPartnerUser(Long partnerId, String email, String fullName) {
    get(partnerId); // 404 if the partner does not exist
    String tempPassword = uniqueCode() + uniqueCode(); // 16-char temp password
    PartnerUser u = new PartnerUser();
    u.setPartnerId(partnerId);
    u.setEmail(email);
    u.setFullName(fullName);
    u.setActive(true);
    u.setPasswordHash(passwordEncoder.encode(tempPassword));
    return new PartnerUserResult(partnerUserRepository.save(u), tempPassword);
  }

  private String uniqueCode() {
    String candidate;
    do {
      StringBuilder sb = new StringBuilder(CODE_LENGTH);
      for (int i = 0; i < CODE_LENGTH; i++) {
        sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
      }
      candidate = sb.toString();
    } while (inviteCodeRepository.findByCode(candidate).isPresent());
    return candidate;
  }

  /** Portal accounts of a partner, for the back-office. */
  @Transactional(readOnly = true)
  public List<PartnerUser> listPartnerUsers(Long partnerId) {
    return partnerUserRepository.findByPartnerId(partnerId);
  }

  /**
   * Enable or disable a portal account. Disabling revokes every session in the same transaction:
   * otherwise a salesperson who left a feed supplier keeps their access until the refresh token
   * expires.
   */
  @Transactional
  public PartnerUser setPartnerUserActive(Long partnerUserId, boolean active) {
    PartnerUser user =
        partnerUserRepository
            .findById(partnerUserId)
            .orElseThrow(() -> NotFoundException.of("PartnerUser", partnerUserId));
    user.setActive(active);
    if (!active) {
      refreshTokenService.revokeAllForPartnerUser(partnerUserId);
    }
    return user;
  }

  /** Issue a new temporary password and drop every existing session. */
  @Transactional
  public String resetPartnerUserPassword(Long partnerUserId) {
    PartnerUser user =
        partnerUserRepository
            .findById(partnerUserId)
            .orElseThrow(() -> NotFoundException.of("PartnerUser", partnerUserId));
    String temporary = TemporaryPasswordGenerator.generate();
    user.setPasswordHash(passwordEncoder.encode(temporary));
    refreshTokenService.revokeAllForPartnerUser(partnerUserId);
    return temporary;
  }

  /** Invite codes of a partner, including the revoked ones (the history matters). */
  @Transactional(readOnly = true)
  public List<PartnerInviteCode> listInviteCodes(Long partnerId) {
    return inviteCodeRepository.findByPartnerId(partnerId);
  }

  /** Revoke an invite code. Kept as a row: a code that circulated is worth remembering. */
  @Transactional
  public PartnerInviteCode revokeInviteCode(Long codeId) {
    PartnerInviteCode code =
        inviteCodeRepository
            .findById(codeId)
            .orElseThrow(() -> NotFoundException.of("PartnerInviteCode", codeId));
    code.setActive(false);
    return inviteCodeRepository.save(code);
  }
}
