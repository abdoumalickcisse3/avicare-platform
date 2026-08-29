package com.avicare.admin.service;

import com.avicare.admin.dto.response.FarmPurgePreview;
import com.avicare.admin.repository.AdminAuditLogRepository;
import com.avicare.admin.spi.FarmDataExporter;
import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ForbiddenException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.identity.service.RefreshTokenService;
import com.avicare.tenancy.domain.Farm;
import com.avicare.tenancy.repository.FarmRepository;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Data portability and the right to erasure (console Phase 2).
 *
 * <p>Two irreversible actions live here, and the schema decides the shape of both.
 *
 * <p><b>Accounts are anonymised, never deleted.</b> {@code users(id)} is referenced by 59 columns,
 * 45 of them with no {@code ON DELETE} clause: a delete would simply fail for anyone who has
 * created anything. Anonymising keeps the history true — who did what — while the person behind it
 * becomes unidentifiable.
 *
 * <p><b>A farm purge is the most destructive operation on the platform.</b> All 28 columns
 * referencing {@code farms(id)} are {@code ON DELETE CASCADE}, so removing the row takes flocks,
 * sales, invoices and expenses with it, silently. Three conditions gate it: the farm must already
 * be soft-deleted, the deletion must be {@value #RETENTION_DAYS} days old, and an export must have
 * been taken since. The caller also retypes the farm name — a checkbox is clicked by reflex.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ComplianceService {

  static final int RETENTION_DAYS = 30;
  static final String EXPORT_ACTION = "compliance.farm.export";

  private final List<FarmDataExporter> exporters;
  private final FarmRepository farms;
  private final UserRepository users;
  private final IdentityFacade identityFacade;
  private final RefreshTokenService refreshTokenService;
  private final AdminAuditLogRepository auditLog;
  private final AdminAuditService auditService;

  /** The farm's whole record, one section per contributing context. */
  @Transactional(readOnly = true)
  public Map<String, Object> exportFarm(Long farmId) {
    Farm farm = loadFarm(farmId);
    Map<String, Object> bundle = new LinkedHashMap<>();
    bundle.put("exportedAt", LocalDateTime.now());
    bundle.put("farmId", farmId);
    // Naming the sections makes a missing context visible instead of silently absent.
    bundle.put("sections", exporters.stream().map(FarmDataExporter::section).sorted().toList());
    for (FarmDataExporter exporter : exporters) {
      bundle.put(exporter.section(), exporter.export(farmId));
    }
    auditService.record(EXPORT_ACTION, "Farm", farmId, farmId, Map.of("farmName", farm.getName()));
    return bundle;
  }

  /** Every soft-deleted farm with its purge readiness — the compliance screen's landing list. */
  @Transactional(readOnly = true)
  public List<FarmPurgePreview> deletedFarms() {
    return farms.findSoftDeleted().stream().map(f -> purgePreview(f.getId())).toList();
  }

  /** What a purge would destroy, and which conditions are met so far. */
  @Transactional(readOnly = true)
  public FarmPurgePreview purgePreview(Long farmId) {
    Farm farm = loadFarm(farmId);
    LocalDateTime deletedAt = farm.getDeletedAt();
    LocalDateTime lastExport =
        auditLog
            .findFirstByActionAndTargetIdOrderByCreatedAtDesc(EXPORT_ACTION, farmId)
            .map(entry -> entry.getCreatedAt())
            .orElse(null);

    Long days =
        deletedAt == null ? null : Duration.between(deletedAt, LocalDateTime.now()).toDays();
    boolean retentionElapsed = days != null && days >= RETENTION_DAYS;
    // The export must postdate the deletion, or it describes a farm that has changed since.
    boolean exportDone = lastExport != null && deletedAt != null && lastExport.isAfter(deletedAt);

    return new FarmPurgePreview(
        farmId,
        farm.getName(),
        deletedAt,
        days,
        lastExport,
        exportDone,
        retentionElapsed,
        deletedAt != null && retentionElapsed && exportDone,
        countsOf(farmId));
  }

  /** Erase a soft-deleted farm and everything that cascades from it. Irreversible. */
  @Transactional
  public void purgeFarm(Long farmId, String confirmationName) {
    Farm farm = loadFarm(farmId);
    FarmPurgePreview preview = purgePreview(farmId);

    if (farm.getDeletedAt() == null) {
      throw new BusinessRuleException(
          "FARM_NOT_DELETED", "Cette ferme est active. Supprimez-la d'abord.");
    }
    if (!preview.retentionElapsed()) {
      throw new BusinessRuleException(
          "FARM_RETENTION_NOT_ELAPSED",
          "Supprimée depuis "
              + preview.daysSinceDeletion()
              + " jours. La purge est possible après "
              + RETENTION_DAYS
              + " jours.");
    }
    if (!preview.exportDone()) {
      throw new BusinessRuleException(
          "FARM_EXPORT_REQUIRED",
          "Exportez les données de cette ferme avant de les effacer définitivement.");
    }
    if (!farm.getName().equals(confirmationName)) {
      throw new BusinessRuleException(
          "FARM_NAME_MISMATCH", "Le nom saisi ne correspond pas à celui de la ferme.");
    }

    // Audited first: the entry must exist even if the delete then fails, and the farm's name is
    // about to stop being readable anywhere.
    auditService.record(
        "compliance.farm.purge",
        "Farm",
        farmId,
        farmId,
        Map.of("farmName", farm.getName(), "counts", preview.counts()));
    farms.hardDeleteById(farmId);
    log.warn("Farm {} purged permanently", farmId);
  }

  /**
   * Strip an account of its personal data and close every session it holds.
   *
   * <p>Staff accounts are refused: withdrawing console access is its own decision, with its own
   * guards, and anonymising one here would slip past them.
   */
  @Transactional
  public String anonymizeUser(Long userId) {
    User user =
        users
            .findById(userId)
            .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User " + userId));
    if (userId.equals(TenancyContext.tryGet().map(t -> t.userId()).orElse(null))) {
      throw new ForbiddenException(
          "COMPLIANCE_SELF_ANONYMIZE", "Vous ne pouvez pas anonymiser votre propre compte.");
    }
    if (user.getRole() == UserRole.ADMIN) {
      throw new BusinessRuleException(
          "COMPLIANCE_STAFF_ACCOUNT",
          "Retirez d'abord l'accès console de ce compte depuis l'écran Personnel.");
    }

    String previousEmail = user.getEmail();
    String placeholder = identityFacade.anonymize(userId);
    refreshTokenService.revokeAllForUser(userId);
    auditService.record(
        "compliance.user.anonymize",
        "User",
        userId,
        null,
        Map.of("previousEmail", previousEmail, "placeholder", placeholder));
    return placeholder;
  }

  /** How many records each section holds — computed from the exporters, not from a second count. */
  private Map<String, Integer> countsOf(Long farmId) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    for (FarmDataExporter exporter : exporters) {
      exporter
          .export(farmId)
          .forEach(
              (key, value) -> {
                if (value instanceof Collection<?> rows) {
                  counts.merge(key, rows.size(), Integer::sum);
                }
              });
    }
    return counts;
  }

  private Farm loadFarm(Long farmId) {
    // findById honours @SQLRestriction, which hides the soft-deleted farms this screen is about.
    return farms
        .findAnyById(farmId)
        .orElseThrow(() -> new NotFoundException("FARM_NOT_FOUND", "Farm " + farmId));
  }
}
