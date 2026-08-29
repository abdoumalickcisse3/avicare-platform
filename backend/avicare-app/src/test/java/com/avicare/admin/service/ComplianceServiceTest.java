package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.admin.domain.AdminAuditLog;
import com.avicare.admin.dto.response.FarmPurgePreview;
import com.avicare.admin.repository.AdminAuditLogRepository;
import com.avicare.admin.spi.FarmDataExporter;
import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ForbiddenException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.common.tenancy.context.TenantData;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.identity.service.RefreshTokenService;
import com.avicare.tenancy.domain.Farm;
import com.avicare.tenancy.repository.FarmRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ComplianceServiceTest {

  private static final Long ACTOR = 1L;
  private static final Long FARM = 8L;
  private static final String FARM_NAME = "Ferme de Rosya";

  @Mock FarmRepository farms;
  @Mock UserRepository users;
  @Mock IdentityFacade identityFacade;
  @Mock RefreshTokenService refreshTokenService;
  @Mock AdminAuditLogRepository auditLog;
  @Mock AdminAuditService auditService;

  private ComplianceService service;

  /** A stand-in context contributing two lists, so the counts have something to add up. */
  private final FarmDataExporter exporter =
      new FarmDataExporter() {
        @Override
        public String section() {
          return "livestock";
        }

        @Override
        public Map<String, Object> export(Long farmId) {
          return Map.of("sales", List.of(1, 2, 3), "clients", List.of(1));
        }
      };

  @BeforeEach
  void setUp() {
    service =
        new ComplianceService(
            List.of(exporter),
            farms,
            users,
            identityFacade,
            refreshTokenService,
            auditLog,
            auditService);
    TenancyContext.set(new TenantData(ACTOR, List.of(), true));
  }

  @AfterEach
  void tearDown() {
    TenancyContext.clear();
  }

  private Farm farm(LocalDateTime deletedAt) {
    Farm f = new Farm();
    f.setId(FARM);
    f.setName(FARM_NAME);
    ReflectionTestUtils.setField(f, "deletedAt", deletedAt);
    when(farms.findAnyById(FARM)).thenReturn(Optional.of(f));
    return f;
  }

  private void exportedAt(LocalDateTime when) {
    AdminAuditLog entry = new AdminAuditLog();
    ReflectionTestUtils.setField(entry, "createdAt", when);
    when(auditLog.findFirstByActionAndTargetIdOrderByCreatedAtDesc(
            ComplianceService.EXPORT_ACTION, FARM))
        .thenReturn(Optional.of(entry));
  }

  // --- export --------------------------------------------------------------

  @Test
  void exportNamesItsSectionsAndIsAudited() {
    farm(null);

    Map<String, Object> bundle = service.exportFarm(FARM);

    // A context that contributes nothing must be visible as a missing section, not silently absent.
    assertThat(bundle).containsKey("sections").containsKey("livestock");
    assertThat(bundle.get("sections")).isEqualTo(List.of("livestock"));
    verify(auditService)
        .record(eq(ComplianceService.EXPORT_ACTION), eq("Farm"), eq(FARM), eq(FARM), any());
  }

  // --- purge guards --------------------------------------------------------

  @Test
  void previewCountsRowsFromTheExportersThemselves() {
    farm(LocalDateTime.now().minusDays(40));
    exportedAt(LocalDateTime.now().minusDays(1));

    FarmPurgePreview preview = service.purgePreview(FARM);

    // Same source as the erasure, so what is shown and what is destroyed cannot drift apart.
    assertThat(preview.counts()).containsEntry("sales", 3).containsEntry("clients", 1);
    assertThat(preview.purgeable()).isTrue();
  }

  @Test
  void refusesToPurgeAFarmThatIsStillActive() {
    farm(null);

    assertThatThrownBy(() -> service.purgeFarm(FARM, FARM_NAME))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("active");
    verify(farms, never()).hardDeleteById(anyLong());
  }

  @Test
  void refusesToPurgeBeforeTheRetentionPeriod() {
    farm(LocalDateTime.now().minusDays(3));
    exportedAt(LocalDateTime.now());

    // Deleting a farm by mistake must stay recoverable for a while.
    assertThatThrownBy(() -> service.purgeFarm(FARM, FARM_NAME))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("30 jours");
    verify(farms, never()).hardDeleteById(anyLong());
  }

  @Test
  void refusesToPurgeWithoutAnExport() {
    farm(LocalDateTime.now().minusDays(40));

    assertThatThrownBy(() -> service.purgeFarm(FARM, FARM_NAME))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("Exportez");
    verify(farms, never()).hardDeleteById(anyLong());
  }

  @Test
  void ignoresAnExportTakenBeforeTheDeletion() {
    farm(LocalDateTime.now().minusDays(40));
    exportedAt(LocalDateTime.now().minusDays(60));

    // An older export describes a farm that has changed since; it is not the record being erased.
    assertThat(service.purgePreview(FARM).exportDone()).isFalse();
    assertThatThrownBy(() -> service.purgeFarm(FARM, FARM_NAME))
        .isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void refusesAMistypedConfirmationName() {
    farm(LocalDateTime.now().minusDays(40));
    exportedAt(LocalDateTime.now().minusDays(1));

    assertThatThrownBy(() -> service.purgeFarm(FARM, "ferme de rosya"))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("ne correspond pas");
    verify(farms, never()).hardDeleteById(anyLong());
  }

  @Test
  void purgesOnceEveryConditionIsMet_andAuditsBeforeErasing() {
    farm(LocalDateTime.now().minusDays(40));
    exportedAt(LocalDateTime.now().minusDays(1));

    service.purgeFarm(FARM, FARM_NAME);

    // Recorded first: the name is about to stop being readable anywhere.
    var order = org.mockito.Mockito.inOrder(auditService, farms);
    order
        .verify(auditService)
        .record(eq("compliance.farm.purge"), eq("Farm"), eq(FARM), eq(FARM), any());
    order.verify(farms).hardDeleteById(FARM);
  }

  // --- anonymisation -------------------------------------------------------

  private User user(Long id, UserRole role) {
    User u = new User();
    u.setId(id);
    u.setEmail("awa@test.io");
    u.setRole(role);
    u.setActive(true);
    when(users.findById(id)).thenReturn(Optional.of(u));
    return u;
  }

  @Test
  void anonymizesAndClosesEverySession() {
    user(7L, UserRole.USER);
    when(identityFacade.anonymize(7L)).thenReturn("anonymise-7@supprime.invalid");

    String placeholder = service.anonymizeUser(7L);

    assertThat(placeholder).isEqualTo("anonymise-7@supprime.invalid");
    verify(refreshTokenService).revokeAllForUser(7L);
    verify(auditService)
        .record(eq("compliance.user.anonymize"), eq("User"), eq(7L), eq(null), any());
  }

  @Test
  void refusesToAnonymizeYourOwnAccount() {
    user(ACTOR, UserRole.USER);

    assertThatThrownBy(() -> service.anonymizeUser(ACTOR)).isInstanceOf(ForbiddenException.class);
    verify(identityFacade, never()).anonymize(anyLong());
  }

  @Test
  void refusesToAnonymizeAStaffAccount() {
    user(7L, UserRole.ADMIN);

    // Withdrawing console access has its own guards; going through here would slip past them.
    assertThatThrownBy(() -> service.anonymizeUser(7L))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("Personnel");
    verify(identityFacade, never()).anonymize(anyLong());
  }

  @Test
  void keepsThePreviousEmailInTheAuditEntry() {
    user(7L, UserRole.USER);
    when(identityFacade.anonymize(7L)).thenReturn("anonymise-7@supprime.invalid");

    assertThatCode(() -> service.anonymizeUser(7L)).doesNotThrowAnyException();

    // Anonymisation cannot be undone; without this the trail cannot say whose account it was.
    var captor = org.mockito.ArgumentCaptor.<Map<String, Object>>captor();
    verify(auditService).record(anyString(), anyString(), any(), any(), captor.capture());
    assertThat(captor.getValue()).containsEntry("previousEmail", "awa@test.io");
  }
}
