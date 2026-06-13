package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Supplier;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {

  List<Supplier> findByFarmIdAndActiveTrueOrderByCommercialName(Long farmId);

  Optional<Supplier> findByFarmIdAndId(Long farmId, Long id);
}
