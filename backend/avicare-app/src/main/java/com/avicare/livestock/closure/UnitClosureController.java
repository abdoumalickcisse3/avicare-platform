package com.avicare.livestock.closure;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.closure.dto.CloseUnitRequest;
import com.avicare.livestock.closure.dto.UnitClosureResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Closing a production cycle and reading its frozen report.
 *
 * <p>Guards are copied from {@code ProductionUnitController} rather than reinvented: reading needs
 * {@code poultry:read}, and closing or reopening is OWNER/MANAGER — closing is structuring, like
 * creating a unit. A divergent guard on a transverse controller has already undercut a per-species
 * lock in this codebase.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/production-units/{unitId}")
@RequiredArgsConstructor
public class UnitClosureController {

  private static final String READ_PERMISSION =
      "@farmAccess.hasPermission(#farmId, 'poultry:read')";

  private static final String CLOSE_ROLES =
      "@farmAccess.hasRole(#farmId, "
          + "T(com.avicare.common.security.principal.FarmRole).OWNER, "
          + "T(com.avicare.common.security.principal.FarmRole).MANAGER)";

  private final UnitClosureService unitClosureService;

  @PostMapping("/close")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(CLOSE_ROLES)
  public ApiResponse<UnitClosureResponse> close(
      @PathVariable Long farmId,
      @PathVariable Long unitId,
      @RequestBody @Valid CloseUnitRequest request) {
    UnitClosure closure =
        unitClosureService.close(
            farmId,
            unitId,
            request.chickCostXof(),
            request.notes(),
            TenancyContext.currentUserId());
    return ApiResponse.of(UnitClosureResponse.from(closure));
  }

  @GetMapping("/closure")
  @PreAuthorize(READ_PERMISSION)
  public ApiResponse<UnitClosureResponse> get(
      @PathVariable Long farmId, @PathVariable Long unitId) {
    return ApiResponse.of(UnitClosureResponse.from(unitClosureService.get(farmId, unitId)));
  }

  @DeleteMapping("/closure")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(CLOSE_ROLES)
  public void reopen(@PathVariable Long farmId, @PathVariable Long unitId) {
    unitClosureService.reopen(farmId, unitId);
  }
}
