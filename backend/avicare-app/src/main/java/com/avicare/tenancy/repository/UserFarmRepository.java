package com.avicare.tenancy.repository;

import com.avicare.tenancy.domain.UserFarm;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Data access for {@link UserFarm} memberships. {@link #findByUserIdAndActiveTrue(Long)} backs both
 * the central {@code getAccessibleFarmIds(userId)} multi-tenancy lookup and the JWT membership
 * claims.
 */
public interface UserFarmRepository extends JpaRepository<UserFarm, Long> {

  List<UserFarm> findByUserId(Long userId);

  List<UserFarm> findByUserIdAndActiveTrue(Long userId);

  List<UserFarm> findByFarmIdAndActiveTrue(Long farmId);

  /** Every membership, revoked ones included — an export must show who ever had access. */
  List<UserFarm> findByFarmId(Long farmId);

  Optional<UserFarm> findByUserIdAndFarmId(Long userId, Long farmId);

  boolean existsByUserIdAndFarmId(Long userId, Long farmId);
}
