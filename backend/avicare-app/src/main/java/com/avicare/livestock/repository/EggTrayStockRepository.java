package com.avicare.livestock.repository;

import com.avicare.livestock.domain.EggTrayStock;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Data access for {@link EggTrayStock}. One row per farm (UNIQUE {@code farm_id}). */
public interface EggTrayStockRepository extends JpaRepository<EggTrayStock, Long> {

  Optional<EggTrayStock> findByFarmId(Long farmId);

  /** Locked for the rest of the transaction: tray counts are adjusted by read-modify-write. */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT t FROM EggTrayStock t WHERE t.farmId = :farmId")
  Optional<EggTrayStock> findByFarmIdForUpdate(@Param("farmId") Long farmId);
}
