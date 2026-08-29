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
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;

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
}
