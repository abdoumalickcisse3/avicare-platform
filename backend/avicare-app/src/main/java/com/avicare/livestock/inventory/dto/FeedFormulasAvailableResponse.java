package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.inventory.AvailableFormulasResponse;
import com.avicare.livestock.inventory.PlatformFormulaDto;
import java.util.List;

/**
 * The feed formulas a farm can use (Sprint B4-6): platform templates plus the farm's own formulas,
 * the latter mapped to {@link FeedFormulaResponse} (the service-side record carries entities).
 */
public record FeedFormulasAvailableResponse(
    List<PlatformFormulaDto> platformFormulas, List<FeedFormulaResponse> farmFormulas) {

  public static FeedFormulasAvailableResponse from(AvailableFormulasResponse src) {
    return new FeedFormulasAvailableResponse(
        src.platformFormulas(),
        src.farmFormulas().stream().map(FeedFormulaResponse::from).toList());
  }
}
