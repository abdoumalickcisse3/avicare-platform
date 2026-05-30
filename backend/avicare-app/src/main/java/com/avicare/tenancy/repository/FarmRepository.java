package com.avicare.tenancy.repository;

import com.avicare.tenancy.domain.Farm;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Data access for {@link Farm}. Soft-deleted rows are filtered out automatically by the entity's
 * {@code @SQLRestriction}.
 */
public interface FarmRepository extends JpaRepository<Farm, Long> {}
