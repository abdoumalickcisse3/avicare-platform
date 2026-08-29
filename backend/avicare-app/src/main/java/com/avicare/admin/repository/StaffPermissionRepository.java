package com.avicare.admin.repository;

import com.avicare.admin.domain.StaffPermission;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link StaffPermission} entities. */
public interface StaffPermissionRepository extends JpaRepository<StaffPermission, Long> {

  List<StaffPermission> findByUserId(Long userId);

  boolean existsByUserIdAndPermission(Long userId, String permission);

  /** Batch load, so listing N staff members stays one query rather than N. */
  List<StaffPermission> findByUserIdIn(Collection<Long> userIds);

  void deleteByUserId(Long userId);

  /** How many accounts hold the wildcard — the console's lock-out guard reads this. */
  long countByPermission(String permission);
}
