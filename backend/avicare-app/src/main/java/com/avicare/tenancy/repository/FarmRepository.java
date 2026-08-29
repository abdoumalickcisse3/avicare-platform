package com.avicare.tenancy.repository;

import com.avicare.tenancy.domain.Farm;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Data access for {@link Farm}. Soft-deleted rows are filtered out automatically by the entity's
 * {@code @SQLRestriction}.
 */
public interface FarmRepository extends JpaRepository<Farm, Long> {

  /** Ids of all (non-soft-deleted) farms — used by the daily notification scan (Sprint C1). */
  @Query("SELECT f.id FROM Farm f")
  List<Long> findAllIds();

  /**
   * Load a farm even if it is soft-deleted.
   *
   * <p>Native on purpose: {@code @SQLRestriction("deleted_at IS NULL")} is woven into every
   * generated query, so {@code findById} cannot see the very rows the compliance screen is about.
   */
  @Query(value = "SELECT * FROM farms WHERE id = :farmId", nativeQuery = true)
  Optional<Farm> findAnyById(@Param("farmId") Long farmId);

  /** Farms awaiting a purge decision, most recently deleted first. */
  @Query(
      value = "SELECT * FROM farms WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
      nativeQuery = true)
  List<Farm> findSoftDeleted();

  /**
   * Erase the row for good. {@code delete()} cannot do this: the entity carries {@code @SQLDelete},
   * so the inherited method only stamps {@code deleted_at} again. Every table referencing a farm is
   * ON DELETE CASCADE, so this removes the farm's entire history with it.
   */
  @Modifying
  @Query(value = "DELETE FROM farms WHERE id = :farmId", nativeQuery = true)
  void hardDeleteById(@Param("farmId") Long farmId);
}
