package com.avicare.tenancy.repository;

import com.avicare.tenancy.domain.UserFarm;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Data access for {@link UserFarm} memberships. {@link #findByUserId(Long)} backs the central
 * {@code getAccessibleFarmIds(userId)} multi-tenancy lookup.
 */
public interface UserFarmRepository extends JpaRepository<UserFarm, Long> {

  List<UserFarm> findByUserId(Long userId);

  Optional<UserFarm> findByUserIdAndFarmId(Long userId, Long farmId);
}
