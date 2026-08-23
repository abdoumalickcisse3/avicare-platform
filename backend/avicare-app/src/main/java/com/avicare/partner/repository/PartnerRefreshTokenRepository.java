package com.avicare.partner.repository;

import com.avicare.partner.domain.PartnerRefreshToken;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link PartnerRefreshToken} (partner-portal session store). */
public interface PartnerRefreshTokenRepository extends JpaRepository<PartnerRefreshToken, Long> {

  Optional<PartnerRefreshToken> findByToken(String token);

  List<PartnerRefreshToken> findByPartnerUserIdAndRevokedAtIsNull(Long partnerUserId);
}
