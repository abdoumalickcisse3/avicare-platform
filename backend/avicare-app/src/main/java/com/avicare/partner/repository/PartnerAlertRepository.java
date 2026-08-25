package com.avicare.partner.repository;

import com.avicare.partner.domain.AlertCategory;
import com.avicare.partner.domain.AlertStatus;
import com.avicare.partner.domain.PartnerAlert;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link PartnerAlert} entities. */
public interface PartnerAlertRepository extends JpaRepository<PartnerAlert, Long> {

  List<PartnerAlert> findByPartnerIdAndStatusOrderByCreatedAtDesc(
      Long partnerId, AlertStatus status);

  Optional<PartnerAlert> findByPartnerIdAndDedupKeyAndStatus(
      Long partnerId, String dedupKey, AlertStatus status);

  /** Active alerts of one category — the scan reconciles these against the conditions it found. */
  List<PartnerAlert> findByPartnerIdAndCategoryAndStatus(
      Long partnerId, AlertCategory category, AlertStatus status);
}
