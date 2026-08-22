package com.avicare.partner.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerInviteCode;
import com.avicare.partner.domain.PartnerStatus;
import com.avicare.partner.domain.PartnerType;
import com.avicare.partner.repository.PartnerInviteCodeRepository;
import com.avicare.partner.repository.PartnerRepository;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
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

  @Transactional(readOnly = true)
  public List<Partner> list() {
    return partnerRepository.findAll();
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
}
