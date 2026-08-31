package com.avicare.integrity.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.api.response.PageResponse;
import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.integrity.domain.IntegrityFinding;
import com.avicare.integrity.domain.Severity;
import com.avicare.integrity.dto.CheckRow;
import com.avicare.integrity.dto.FindingRow;
import com.avicare.integrity.dto.IntegritySummary;
import com.avicare.integrity.dto.ResolveRequest;
import com.avicare.integrity.service.IntegrityCheckService;
import com.avicare.integrity.service.IntegrityFindingService;
import com.avicare.integrity.service.RecomputeResult;
import com.avicare.integrity.service.RecomputeService;
import jakarta.validation.Valid;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The integrity screen ({@code /console/integrite}).
 *
 * <p>Two permissions, not one. {@code integrity:read} shows what is wrong; {@code
 * integrity:recompute} rewrites a farmer's live figures. Reading a defect and correcting one are
 * not the same authority, and the second should be grantable to fewer people than the first.
 */
@RestController
@RequestMapping("/api/v1/admin/integrity")
@RequiredArgsConstructor
public class AdminIntegrityController {

  private final IntegrityFindingService findingService;
  private final IntegrityCheckService checkService;
  private final RecomputeService recomputeService;

  @Value("${avicare.integrity.manual-trigger-enabled:true}")
  private boolean manualTriggerEnabled;

  @GetMapping
  @PreAuthorize("@adminAccess.can('integrity:read')")
  public ApiResponse<IntegritySummary> summary(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
    Map<Severity, Long> counts = findingService.openCounts();
    Page<FindingRow> findings =
        findingService
            .openFindings(PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100)))
            .map(this::toRow);
    return ApiResponse.of(
        new IntegritySummary(
            counts.getOrDefault(Severity.CRITICAL, 0L),
            counts.getOrDefault(Severity.WARNING, 0L),
            counts.getOrDefault(Severity.INFO, 0L),
            PageResponse.from(findings)));
  }

  /** The catalogue of invariants, so the screen can explain what it is claiming. */
  @GetMapping("/checks")
  @PreAuthorize("@adminAccess.can('integrity:read')")
  public ApiResponse<List<CheckRow>> checks() {
    return ApiResponse.of(
        checkService.catalogue().stream()
            .map(c -> new CheckRow(c.key(), c.label(), c.severity()))
            .toList());
  }

  /** Run the sweep now instead of waiting for 3am — for a support session, or right after a fix. */
  @PostMapping("/run")
  @PreAuthorize("@adminAccess.can('integrity:recompute')")
  public ApiResponse<IntegrityCheckService.SweepReport> run() {
    if (!manualTriggerEnabled) {
      throw new com.avicare.common.api.exception.BusinessRuleException(
          "MANUAL_TRIGGER_DISABLED", "Manual integrity runs are disabled on this environment");
    }
    IntegrityCheckService.SweepReport report = checkService.runAllChecks();
    checkService.notifyNewCriticals();
    return ApiResponse.of(report);
  }

  /** What the recompute would change — shown before anything is written. */
  @GetMapping("/findings/{id}/preview")
  @PreAuthorize("@adminAccess.can('integrity:recompute')")
  public ApiResponse<RecomputeResult> preview(@PathVariable Long id) {
    return ApiResponse.of(findingService.preview(id));
  }

  @PostMapping("/findings/{id}/recompute")
  @PreAuthorize("@adminAccess.can('integrity:recompute')")
  public ApiResponse<RecomputeResult> recompute(
      @PathVariable Long id, @Valid @RequestBody ResolveRequest request) {
    return ApiResponse.of(findingService.applyRecompute(id, request.reason(), currentUserId()));
  }

  @PostMapping("/findings/{id}/accept")
  @PreAuthorize("@adminAccess.can('integrity:recompute')")
  public ApiResponse<FindingRow> accept(
      @PathVariable Long id, @Valid @RequestBody ResolveRequest request) {
    return ApiResponse.of(toRow(findingService.acceptDrift(id, request.reason(), currentUserId())));
  }

  @PostMapping("/findings/{id}/manual-fix")
  @PreAuthorize("@adminAccess.can('integrity:recompute')")
  public ApiResponse<FindingRow> manualFix(
      @PathVariable Long id, @Valid @RequestBody ResolveRequest request) {
    return ApiResponse.of(
        toRow(findingService.markManuallyFixed(id, request.reason(), currentUserId())));
  }

  private FindingRow toRow(IntegrityFinding finding) {
    LocalDateTime detected =
        finding.getDetectedAt() == null ? LocalDateTime.now() : finding.getDetectedAt();
    return new FindingRow(
        finding.getId(),
        finding.getCheckKey(),
        checkService.labelOf(finding.getCheckKey()),
        finding.getSeverity(),
        finding.getEntityType(),
        finding.getEntityId(),
        finding.getFarmId(),
        finding.getExpectedValue(),
        finding.getActualValue(),
        finding.getDetails(),
        finding.getDetectedAt(),
        finding.getLastSeenAt(),
        Duration.between(detected, LocalDateTime.now()).toDays(),
        recomputeService.supports(finding.getEntityType()));
  }

  /** The staff member behind the action — read the way the platform reads it (see JwtFilter). */
  private static Long currentUserId() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    return auth != null && auth.getDetails() instanceof AvicarePrincipal principal
        ? principal.effectiveActorId()
        : null;
  }
}
