package com.avicare.partner.repository;

import com.avicare.partner.domain.Partner;
import com.avicare.partner.domain.PartnerType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link Partner} entities. Soft-deleted rows filtered by {@code @SQLRestriction}.
 */
public interface PartnerRepository extends JpaRepository<Partner, Long> {

  List<Partner> findByType(PartnerType type);
}
