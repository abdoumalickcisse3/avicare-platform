package com.avicare.admin.audit;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.identity.spi.StaffLoginAuditor;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Writes staff sign-ins to the back-office trail. Implements the seam declared by identity, so the
 * dependency arrow stays {@code admin → identity} and never the reverse.
 */
@Component
@RequiredArgsConstructor
public class StaffLoginAuditorImpl implements StaffLoginAuditor {

  private final AdminAuditService auditService;

  @Override
  public void recordStaffLogin(Long userId, String email) {
    auditService.record(userId, "staff.login", "User", userId, null, Map.of("email", email));
  }
}
