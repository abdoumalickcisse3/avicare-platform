package com.avicare.admin.service;

import com.avicare.admin.dto.response.PlatformBackups;
import com.avicare.admin.dto.response.PlatformOverview;
import com.avicare.admin.dto.response.PlatformRuntime;
import com.avicare.admin.repository.StaffPermissionRepository;
import com.avicare.admin.spi.PlatformMetricsContributor;
import com.avicare.identity.repository.UserRepository;
import com.avicare.notification.api.WhatsAppLedger;
import com.avicare.tenancy.repository.FarmRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
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
@lombok.extern.slf4j.Slf4j
public class AdminMetricsService {

  private static final int MAU_DAYS = 30;

  /** Dumps are nightly; past this, a run was missed. */
  static final int STALE_AFTER_HOURS = 36;

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

  /** Where the nightly dumps land, as the container sees them. Empty when nothing is mounted. */
  @Value("${BACKUP_DIR_MOUNTED:}")
  private String backupDir;

  /** An rclone remote is configured. Not a claim that the last upload worked. */
  @Value("${BACKUP_REMOTE_CONFIGURED:false}")
  private String offsiteConfigured;

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

  /**
   * Freshness of the database dumps.
   *
   * <p>Nightly, so anything older than {@value #STALE_AFTER_HOURS} hours means a run was missed —
   * which is the only thing worth an alarm here. A backup that silently stopped is discovered on
   * the day it is needed, and that is the worst possible day to discover it.
   */
  public PlatformBackups backups() {
    if (backupDir == null || backupDir.isBlank()) {
      return new PlatformBackups(false, null, null, 0, 0L, false, offsite());
    }
    Path dir = Path.of(backupDir);
    if (!Files.isDirectory(dir)) {
      return new PlatformBackups(false, null, null, 0, 0L, false, offsite());
    }

    try (Stream<Path> files = Files.list(dir)) {
      List<Path> dumps =
          files
              .filter(Files::isRegularFile)
              .filter(p -> p.getFileName().toString().endsWith(".sql.gz"))
              .toList();

      if (dumps.isEmpty()) {
        // Mounted and empty is a real state, and a worrying one — not the same as not mounted.
        return new PlatformBackups(true, null, null, 0, 0L, true, offsite());
      }

      long totalBytes = 0L;
      FileTime newest = null;
      for (Path dump : dumps) {
        totalBytes += Files.size(dump);
        FileTime modified = Files.getLastModifiedTime(dump);
        if (newest == null || modified.compareTo(newest) > 0) {
          newest = modified;
        }
      }

      LocalDateTime lastDumpAt =
          LocalDateTime.ofInstant(newest.toInstant(), ZoneId.systemDefault());
      long ageHours = Duration.between(lastDumpAt, LocalDateTime.now()).toHours();
      return new PlatformBackups(
          true,
          lastDumpAt,
          ageHours,
          dumps.size(),
          totalBytes,
          ageHours > STALE_AFTER_HOURS,
          offsite());
    } catch (IOException e) {
      log.warn("Could not read the backup directory {}: {}", backupDir, e.getMessage());
      return new PlatformBackups(false, null, null, 0, 0L, false, offsite());
    }
  }

  private boolean offsite() {
    return "true".equalsIgnoreCase(offsiteConfigured);
  }

  /** The window, in days, behind {@code monthlyActiveUsers}. */
  public static int mauDays() {
    return MAU_DAYS;
  }
}
