package com.avicare.tenancy.repository;

import com.avicare.tenancy.domain.Farm;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Data access for {@link Farm}. Soft-deleted rows are filtered out automatically by the entity's
 * {@code @SQLRestriction}.
 */
public interface FarmRepository extends JpaRepository<Farm, Long> {

  /** Ids of all (non-soft-deleted) farms — used by the daily notification scan (Sprint C1). */
  @Query("SELECT f.id FROM Farm f")
  List<Long> findAllIds();
}
