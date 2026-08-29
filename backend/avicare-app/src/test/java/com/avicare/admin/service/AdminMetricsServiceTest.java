package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.avicare.admin.dto.response.PlatformOverview;
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
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminMetricsServiceTest {

  @Mock FarmRepository farms;
  @Mock UserRepository users;
  @Mock StaffPermissionRepository staffPermissions;
  @Mock WhatsAppLedger whatsAppLedger;
  @Mock JdbcTemplate jdbcTemplate;

  private AdminMetricsService service(PlatformMetricsContributor... contributors) {
    return new AdminMetricsService(
        List.of(contributors),
        farms,
        users,
        staffPermissions,
        whatsAppLedger,
        new org.springframework.beans.factory.ObjectProvider<>() {
          @Override
          public JdbcTemplate getIfAvailable() {
            return jdbcTemplate;
          }

          @Override
          public JdbcTemplate getObject() {
            return jdbcTemplate;
          }

          @Override
          public JdbcTemplate getObject(Object... args) {
            return jdbcTemplate;
          }

          @Override
          public JdbcTemplate getIfUnique() {
            return jdbcTemplate;
          }
        });
  }

  private PlatformMetricsContributor contributor(Map<String, Long> counters) {
    return () -> counters;
  }

  @BeforeEach
  void setUp() {
    when(users.count()).thenReturn(18L);
    when(staffPermissions.count()).thenReturn(1L);
  }

  @Test
  void mergesEveryContributorIntoTheVolumes() {
    PlatformOverview overview =
        service(contributor(Map.of("productionUnits", 12L)), contributor(Map.of("expenses", 40L)))
            .overview();

    // A context added later contributes without the cockpit being touched.
    assertThat(overview.volumes())
        .containsEntry("productionUnits", 12L)
        .containsEntry("expenses", 40L);
  }

  @Test
  void reportsNoVolumesRatherThanFailingWhenNoContextContributes() {
    PlatformOverview overview = service().overview();

    assertThat(overview.volumes()).isEmpty();
    assertThat(overview.users()).isEqualTo(18);
  }

  @Test
  void derivesActiveFarmsFromTheDeletedCount() {
    when(farms.countAll()).thenReturn(14L);
    when(farms.countSoftDeleted()).thenReturn(1L);

    PlatformOverview overview = service().overview();

    // Soft-deleted farms still hold rows, so the two numbers are not interchangeable.
    assertThat(overview.farms()).isEqualTo(14);
    assertThat(overview.deletedFarms()).isEqualTo(1);
    assertThat(overview.activeFarms()).isEqualTo(13);
  }

  @Test
  void reportsAnUnknownSchemaRatherThanFailingWithoutADatabase() {
    when(jdbcTemplate.queryForObject(anyString(), eq(String.class))).thenReturn(null);
    when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(null);

    // queryForObject returns null on an empty result; the cockpit must not 500 over it.
    assertThat(service().runtime().schemaVersion()).isNull();
    assertThat(service().runtime().appliedMigrations()).isZero();
  }

  @Test
  void passesTheRequestedWindowThrough() {
    when(whatsAppLedger.usage(7))
        .thenReturn(new WhatsAppLedger.Usage(7, 3, 1, 0, Map.of(), Map.of()));

    assertThat(service().whatsappUsage(7).days()).isEqualTo(7);
  }

  // --- backup freshness ----------------------------------------------------

  private AdminMetricsService serviceWithBackupDir(String dir) {
    AdminMetricsService s = service();
    ReflectionTestUtils.setField(s, "backupDir", dir);
    ReflectionTestUtils.setField(s, "offsiteConfigured", "true");
    return s;
  }

  private static void dump(Path dir, String name, Instant modified) throws IOException {
    Path file = dir.resolve(name);
    Files.writeString(file, "gzip-bytes");
    Files.setLastModifiedTime(file, FileTime.from(modified));
  }

  @Test
  void reportsNotMountedRatherThanPretendingWhenThereIsNoDirectory() {
    // A local run has no mount; claiming "no backups" there would be a false alarm.
    assertThat(serviceWithBackupDir("").backups().mounted()).isFalse();
    assertThat(serviceWithBackupDir("/nowhere/at/all").backups().mounted()).isFalse();
  }

  @Test
  void readsTheFreshestDumpAndSumsTheRest(@TempDir Path dir) throws IOException {
    dump(dir, "avicare_2026-08-27.sql.gz", Instant.now().minus(Duration.ofHours(50)));
    dump(dir, "avicare_2026-08-29.sql.gz", Instant.now().minus(Duration.ofHours(6)));
    Files.writeString(dir.resolve("notes.txt"), "not a dump");

    var backups = serviceWithBackupDir(dir.toString()).backups();

    assertThat(backups.mounted()).isTrue();
    // Only .sql.gz counts: anything else in the folder is not a backup.
    assertThat(backups.dumpCount()).isEqualTo(2);
    assertThat(backups.ageHours()).isBetween(5L, 7L);
    assertThat(backups.stale()).isFalse();
    assertThat(backups.totalBytes()).isPositive();
  }

  @Test
  void flagsADumpOlderThanANight(@TempDir Path dir) throws IOException {
    dump(dir, "avicare_old.sql.gz", Instant.now().minus(Duration.ofHours(40)));

    // A backup that silently stopped is discovered on the day it is needed.
    assertThat(serviceWithBackupDir(dir.toString()).backups().stale()).isTrue();
  }

  @Test
  void treatsAMountedButEmptyDirectoryAsAlarming(@TempDir Path dir) {
    var backups = serviceWithBackupDir(dir.toString()).backups();

    // Mounted and empty is a real state, and not the same as not mounted.
    assertThat(backups.mounted()).isTrue();
    assertThat(backups.dumpCount()).isZero();
    assertThat(backups.stale()).isTrue();
  }

  @Test
  void saysOffsiteIsConfigured_notThatItSucceeded(@TempDir Path dir) throws IOException {
    dump(dir, "avicare_now.sql.gz", Instant.now());

    AdminMetricsService s = service();
    ReflectionTestUtils.setField(s, "backupDir", dir.toString());
    ReflectionTestUtils.setField(s, "offsiteConfigured", "");

    // The container cannot see the remote; a green light meaning nothing is worse than none.
    assertThat(s.backups().offsiteConfigured()).isFalse();
    assertThat(serviceWithBackupDir(dir.toString()).backups().offsiteConfigured()).isTrue();
  }
}
