package com.avicare.admin.repository;

import com.avicare.admin.domain.StaffPermission;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link StaffPermission} entities. */
public interface StaffPermissionRepository extends JpaRepository<StaffPermission, Long> {

  List<StaffPermission> findByUserId(Long userId);

  boolean existsByUserIdAndPermission(Long userId, String permission);
}
