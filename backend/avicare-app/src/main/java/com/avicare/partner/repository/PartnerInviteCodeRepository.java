package com.avicare.partner.repository;

import com.avicare.partner.domain.PartnerInviteCode;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link PartnerInviteCode} entities. */
public interface PartnerInviteCodeRepository extends JpaRepository<PartnerInviteCode, Long> {

  Optional<PartnerInviteCode> findByCode(String code);

  List<PartnerInviteCode> findByPartnerId(Long partnerId);
}
