package com.avicare.partner.repository;

import com.avicare.partner.domain.PartnerUser;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link PartnerUser} accounts. */
public interface PartnerUserRepository extends JpaRepository<PartnerUser, Long> {

  Optional<PartnerUser> findByEmail(String email);
}
