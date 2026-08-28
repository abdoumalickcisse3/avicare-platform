package com.avicare.admin.bootstrap;

import com.avicare.admin.domain.StaffPermission;
import com.avicare.admin.repository.StaffPermissionRepository;
import com.avicare.admin.service.AdminAuditService;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Promotes the configured founder account to platform staff at startup, and grants it the {@code *}
 * permission.
 *
 * <p>An {@code ApplicationRunner} rather than a Flyway migration, for three reasons: a merged
 * migration is immutable forever and would carve a personal email into the schema; it could not be
 * replayed if the account is created later; and it cannot read an environment-supplied
 * configuration.
 *
 * <p>Idempotent, and it <b>never creates an account</b> — an unknown email logs a warning and the
 * application carries on. The promotion is itself audited: the one action nobody could otherwise be
 * held to.
 *
 * <p>It is also the lock-out safety net for the {@code "*"} permission model: deleting that row by
 * accident is undone by the next restart.
 */
@Component
@ConditionalOnProperty(name = "avicare.admin.founder-email")
@RequiredArgsConstructor
@Slf4j
public class FounderAdminInitializer implements ApplicationRunner {

  private static final String ALL_PERMISSIONS = "*";

  private final UserRepository userRepository;
  private final StaffPermissionRepository staffPermissions;
  private final AdminAuditService auditService;

  @Value("${avicare.admin.founder-email}")
  private String founderEmail;

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (founderEmail == null || founderEmail.isBlank()) {
      return;
    }
    userRepository
        .findByEmailIgnoreCase(founderEmail.trim())
        .ifPresentOrElse(
            this::promote,
            () ->
                log.warn(
                    "Founder staff account '{}' not found — no account was created. Sign it up "
                        + "first, then restart.",
                    founderEmail));
  }

  private void promote(User user) {
    boolean roleChanged = user.getRole() != UserRole.ADMIN;
    if (roleChanged) {
      user.setRole(UserRole.ADMIN);
      userRepository.save(user);
    }

    boolean permissionGranted = false;
    if (!staffPermissions.existsByUserIdAndPermission(user.getId(), ALL_PERMISSIONS)) {
      StaffPermission permission = new StaffPermission();
      permission.setUserId(user.getId());
      permission.setPermission(ALL_PERMISSIONS);
      permission.setGrantedBy(user.getId());
      staffPermissions.save(permission);
      permissionGranted = true;
    }

    if (roleChanged || permissionGranted) {
      log.info("Founder staff account provisioned for user {}", user.getId());
      auditService.record(
          user.getId(),
          "staff.founder.provision",
          "User",
          user.getId(),
          null,
          Map.of("roleChanged", roleChanged, "permissionGranted", permissionGranted));
    }
  }
}
