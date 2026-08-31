package com.avicare.admin.service;

import com.avicare.admin.domain.AdminAuditLog;
import com.avicare.admin.repository.AdminAuditLogRepository;
import com.avicare.common.api.filter.CorrelationIdFilter;
import com.avicare.common.api.web.ClientIp;
import com.avicare.common.tenancy.context.TenancyContext;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Writes the platform back-office audit trail (super-admin console, Phase 0).
 *
 * <p>Runs in {@link Propagation#REQUIRES_NEW}: the entry must survive a rollback of the business
 * transaction that triggered it. An action that failed halfway is exactly the one worth having a
 * trace of — losing it with the rollback would leave the trail quietly incomplete.
 *
 * <p>Never throws. A trail that can break the action it records would be worse than no trail: it
 * would make the console fail on its own bookkeeping.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAuditService {

  private final AdminAuditLogRepository repository;

  /** Record a staff action. {@code tenantId} is set whenever the action concerns a farm. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void record(
      String action,
      String targetType,
      Long targetId,
      Long tenantId,
      Map<String, Object> metadata) {
    record(currentActorId(), action, targetType, targetId, tenantId, metadata);
  }

  /**
   * Record with an explicit actor — for the paths where no tenancy context exists yet (the founder
   * bootstrap promotes an account before anyone is authenticated).
   */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void record(
      Long actorUserId,
      String action,
      String targetType,
      Long targetId,
      Long tenantId,
      Map<String, Object> metadata) {
    try {
      repository.save(
          new AdminAuditLog(
              actorUserId,
              action,
              targetType,
              targetId,
              tenantId,
              metadata,
              currentIp(),
              MDC.get(CorrelationIdFilter.MDC_KEY)));
    } catch (RuntimeException e) {
      // Loud, because a silent hole in an audit trail is the worst of both worlds.
      log.error(
          "Failed to record admin audit entry action={} target={}:{} actor={}",
          action,
          targetType,
          targetId,
          actorUserId,
          e);
    }
  }

  private static Long currentActorId() {
    return TenancyContext.tryGet().map(t -> t.userId()).orElse(null);
  }

  private static String currentIp() {
    if (RequestContextHolder.getRequestAttributes()
        instanceof ServletRequestAttributes attributes) {
      return ClientIp.of(attributes.getRequest());
    }
    return null;
  }
}
