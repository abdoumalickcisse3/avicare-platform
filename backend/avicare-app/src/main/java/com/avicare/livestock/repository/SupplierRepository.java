package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Supplier;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

  List<Supplier> findByFarmIdAndActiveTrueOrderByCommercialName(Long farmId);

  Optional<Supplier> findByFarmIdAndId(Long farmId, Long id);

  /**
   * Farm-scoped lookup by a batch of ids. Used where a caller has a set of ids it already believes
   * belong to this farm (e.g. from a farm-scoped aggregate) but wants the tenant boundary enforced
   * structurally rather than inherited from that belief.
   */
  List<Supplier> findByFarmIdAndIdIn(Long farmId, Collection<Long> ids);
}
