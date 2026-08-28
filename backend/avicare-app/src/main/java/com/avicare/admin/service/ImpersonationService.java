package com.avicare.admin.service;

import com.avicare.common.api.exception.BusinessException;
import com.avicare.common.security.jwt.JwtService;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.Membership;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.identity.spi.MembershipProvider;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opens a support session as a farmer.
 *
 * <p>The token carries the TARGET's identity, role and memberships, so the staff member sees
 * exactly what the farmer sees — including their missing permissions and their disabled modules.
 * That is the whole point: a token that kept the staff role would keep the tenant bypass and prove
 * nothing.
 *
 * <p>Short-lived and non-renewable. Both the opening and the closing are audited; a support session
 * nobody can reconstruct afterwards is not supervision, it is a back door.
 */
@Service
@RequiredArgsConstructor
public class ImpersonationService {

  private final JwtService jwtService;
  private final IdentityFacade identityFacade;
  private final MembershipProvider membershipProvider;
  private final AdminAuditService auditService;

  @Value("${avicare.admin.impersonation-ttl:PT15M}")
  private Duration ttl;

  /** Mint a support token for {@code targetUserId} on behalf of {@code staffUserId}. */
  @Transactional
  public String open(Long staffUserId, Long targetUserId, String reason) {
    UserInfo target = identityFacade.findById(targetUserId);

    if (target.role() == UserRole.ADMIN) {
      // Lateral escalation between staff accounts: a support session is for reaching a farmer's
      // view, never another staff member's authority.
      throw new ImpersonationRefusedException("Cannot impersonate another staff account");
    }
    if (!target.active()) {
      throw new ImpersonationRefusedException("Cannot impersonate a disabled account");
    }

    List<Membership> memberships = membershipProvider.membershipsFor(targetUserId);
    AvicarePrincipal principal =
        new AvicarePrincipal(target.id(), target.email(), target.role(), memberships);

    auditService.record(
        staffUserId,
        "impersonation.open",
        "User",
        targetUserId,
        null,
        Map.of("reason", reason == null ? "" : reason, "ttlSeconds", ttl.toSeconds()));

    return jwtService.generateImpersonationToken(principal, staffUserId, ttl);
  }

  /** Record the end of a support session. */
  @Transactional
  public void close(Long staffUserId, Long targetUserId) {
    auditService.record(staffUserId, "impersonation.close", "User", targetUserId, null, Map.of());
  }

  /** A support session that must not be opened. */
  public static class ImpersonationRefusedException extends BusinessException {
    public ImpersonationRefusedException(String message) {
      super("IMPERSONATION_REFUSED", message, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }
}
