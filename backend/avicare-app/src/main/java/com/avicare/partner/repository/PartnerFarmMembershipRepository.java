package com.avicare.partner.repository;

import com.avicare.partner.domain.MembershipStatus;
import com.avicare.partner.domain.PartnerFarmMembership;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link PartnerFarmMembership} entities. */
public interface PartnerFarmMembershipRepository
    extends JpaRepository<PartnerFarmMembership, Long> {

  List<PartnerFarmMembership> findByPartnerIdAndStatusNot(Long partnerId, MembershipStatus status);

  List<PartnerFarmMembership> findByFarmIdAndStatusNot(Long farmId, MembershipStatus status);

  Optional<PartnerFarmMembership> findByPartnerIdAndFarmIdAndStatusNot(
      Long partnerId, Long farmId, MembershipStatus status);
}
