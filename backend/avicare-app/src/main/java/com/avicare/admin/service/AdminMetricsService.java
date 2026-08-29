package com.avicare.admin.service;

import com.avicare.admin.dto.response.PlatformOverview;
import com.avicare.admin.dto.response.PlatformRuntime;
import com.avicare.admin.repository.StaffPermissionRepository;
import com.avicare.admin.spi.PlatformMetricsContributor;
import com.avicare.identity.repository.UserRepository;
import com.avicare.notification.api.WhatsAppLedger;
import com.avicare.tenancy.repository.FarmRepository;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Platform cockpit (console Phase 3).
 *
 * <p>Volumes come from {@link PlatformMetricsContributor} implementations rather than from the
 * console reaching into every domain — the same inversion as the compliance export, for the same
 * reason: a cockpit that reads other contexts' tables is the thing that breaks when they are
 * refactored.
 */
@Service
@RequiredArgsConstructor
public class AdminMetricsService {

  private static final int MAU_DAYS = 30;

  private final List<PlatformMetricsContributor> contributors;
  private final FarmRepository farms;
  private final UserRepository users;
  private final StaffPermissionRepository staffPermissions;
  private final WhatsAppLedger whatsAppLedger;

  /**
   * Optional on purpose: the DB-less test contexts boot the web layer with no {@code DataSource},
   * so there is no {@code JdbcTemplate} and no schema to report. Everything else on this screen
   * still answers — only the schema line goes unknown.
   */
  private final ObjectProvider<JdbcTemplate> jdbcTemplate;

  @Value("${notifications.whatsapp.enabled:false}")
  private boolean whatsappEnabled;

  @Transactional(readOnly = true)
  public PlatformOverview overview() {
    Map<String, Long> volumes = new LinkedHashMap<>();
    for (PlatformMetricsContributor contributor : contributors) {
      volumes.putAll(contributor.counters());
    }

    long allFarms = farms.countAll();
    long deleted = farms.countSoftDeleted();

    return new PlatformOverview(
        allFarms,
        allFarms - deleted,
        deleted,
        users.count(),
        users.countByActiveTrue(),
        users.countByLastLoginAtAfter(LocalDateTime.now().minusDays(MAU_DAYS)),
        staffPermissions.count(),
        volumes,
        LocalDateTime.now());
  }

  @Transactional(readOnly = true)
  public WhatsAppLedger.Usage whatsappUsage(int days) {
    return whatsAppLedger.usage(days);
  }

  @Transactional(readOnly = true)
  public List<WhatsAppLedger.FailedMessage> whatsappFailures() {
    return whatsAppLedger.recentFailures(20);
  }

  @Transactional
  public boolean retryWhatsApp(Long outboxId) {
    return whatsAppLedger.retry(outboxId);
  }

  @Transactional(readOnly = true)
  public PlatformRuntime runtime() {
    JdbcTemplate jdbc = jdbcTemplate.getIfAvailable();
    String version = null;
    long applied = 0L;
    if (jdbc != null) {
      // Flyway's own table rather than a constant: it says what the running database actually has,
      // which is the only answer worth showing during an incident.
      version =
          jdbc.queryForObject(
              "SELECT version FROM flyway_schema_history WHERE success"
                  + " ORDER BY installed_rank DESC LIMIT 1",
              String.class);
      Long count =
          jdbc.queryForObject(
              "SELECT COUNT(*) FROM flyway_schema_history WHERE success", Long.class);
      applied = count == null ? 0L : count;
    }
    return new PlatformRuntime(
        version,
        applied,
        // Null outside a packaged jar, which is exactly what a local run should show.
        getClass().getPackage().getImplementationVersion(),
        LocalDateTime.now(),
        whatsappEnabled);
  }

  /** The window, in days, behind {@code monthlyActiveUsers}. */
  public static int mauDays() {
    return MAU_DAYS;
  }
}
