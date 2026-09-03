package com.avicare.livestock.closure;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.closure.dto.ClosureSummaryResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The farm's closed cycles, side by side.
 *
 * <p>A farm-level resource rather than a sub-path of one unit: the whole point is to read several
 * batches at once. Reading needs {@code poultry:read}, the same guard the units themselves carry.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/closures")
@RequiredArgsConstructor
public class ClosureListController {

  private final UnitClosureService unitClosureService;

  @GetMapping
  @PreAuthorize("@farmAccess.hasPermission(#farmId, 'poultry:read')")
  public ApiResponse<List<ClosureSummaryResponse>> list(@PathVariable Long farmId) {
    return ApiResponse.of(unitClosureService.listForFarm(farmId));
  }
}
