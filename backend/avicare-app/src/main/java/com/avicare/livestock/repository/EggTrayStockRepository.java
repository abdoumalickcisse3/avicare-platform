package com.avicare.livestock.repository;

import com.avicare.livestock.domain.EggTrayStock;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link EggTrayStock}. One row per farm (UNIQUE {@code farm_id}). */
public interface EggTrayStockRepository extends JpaRepository<EggTrayStock, Long> {

  Optional<EggTrayStock> findByFarmId(Long farmId);
}
