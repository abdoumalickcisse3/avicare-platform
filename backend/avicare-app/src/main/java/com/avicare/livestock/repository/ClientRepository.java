package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Client;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClientRepository extends JpaRepository<Client, Long> {

  List<Client> findByFarmIdAndActiveTrueOrderByDisplayName(Long farmId);

  /** Every client, inactive ones included — an export is a snapshot, not a working list. */
  List<Client> findByFarmIdOrderById(Long farmId);

  Optional<Client> findByFarmIdAndId(Long farmId, Long id);

  /**
   * Active clients of a farm whose receivable strictly exceeds their (non-null) credit limit, for
   * the indicative over-limit listing (D26 — informative only, never blocks). Ordered by the
   * largest balance first.
   */
  @Query(
      "SELECT c FROM Client c WHERE c.farmId = :farmId AND c.active = true "
          + "AND c.creditLimitXof IS NOT NULL AND c.currentBalanceXof > c.creditLimitXof "
          + "ORDER BY c.currentBalanceXof DESC")
  List<Client> findOverCreditLimit(@Param("farmId") Long farmId);
}
