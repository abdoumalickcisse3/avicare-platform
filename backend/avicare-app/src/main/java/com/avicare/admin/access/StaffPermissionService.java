package com.avicare.admin.access;

import com.avicare.admin.domain.StaffPermission;
import com.avicare.admin.repository.StaffPermissionRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves what a staff member is allowed to do.
 *
 * <p><b>Reads the database on every check, with no cache</b> — a deliberate exception to the
 * project's "the JWT carries everything" rule, for two reasons. Revoking a staff permission must
 * take effect immediately: this is the one role that can touch every tenant, and waiting for a
 * token to expire is not acceptable. And admin traffic is a handful of humans, so the query cost is
 * irrelevant. Putting these in the JWT would also grow every user's token for a claim that under 1%
 * of them carry.
 */
@Service
@RequiredArgsConstructor
public class StaffPermissionService {

  private final StaffPermissionRepository repository;

  /** True when the staff member holds {@code permission}, {@code resource:*} or {@code *}. */
  @Transactional(readOnly = true)
  public boolean has(Long userId, String permission) {
    if (userId == null || permission == null) {
      return false;
    }
    List<String> held =
        repository.findByUserId(userId).stream().map(StaffPermission::getPermission).toList();
    if (held.contains("*") || held.contains(permission)) {
      return true;
    }
    int c = permission.indexOf(':');
    return c > 0 && held.contains(permission.substring(0, c) + ":*");
  }

  @Transactional(readOnly = true)
  public List<String> permissionsOf(Long userId) {
    return userId == null
        ? List.of()
        : repository.findByUserId(userId).stream()
            .map(StaffPermission::getPermission)
            .sorted()
            .toList();
  }
}
