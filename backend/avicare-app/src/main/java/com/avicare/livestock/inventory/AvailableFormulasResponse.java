package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.FeedFormula;
import java.util.List;

/**
 * The feed formulas a farm can pick from (Sprint B4-4): the platform templates and the farm's own
 * custom formulas.
 */
public record AvailableFormulasResponse(
    List<PlatformFormulaDto> platformFormulas, List<FeedFormula> farmFormulas) {}
