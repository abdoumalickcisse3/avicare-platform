package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolParam;
import com.avicare.assistant.tool.ToolSpec;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Consult broiler growth (average daily gain, GMQ) over a window (default 7 days). Read-only: hits
 * {@link LivestockFacade#livestockStats}.
 */
@Component
public class GrowthQueryTool implements ReadTool {

  private static final int DEFAULT_DAYS = 7;
  private static final int MAX_DAYS = 365;

  private final LivestockFacade livestock;

  public GrowthQueryTool(LivestockFacade livestock) {
    this.livestock = livestock;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "GROWTH_QUERY",
        "Consulter la croissance des poulets de chair : gain moyen quotidien (GMQ) sur une période"
            + " (par défaut 7 derniers jours).",
        List.of(
            ToolParam.optional(
                "days", ToolParam.Type.INTEGER, "Nombre de jours à couvrir, défaut 7")));
  }

  @Override
  public String requiredPermission() {
    return "poultry:read";
  }

  @Override
  public String read(Long farmId, Map<String, Object> args, Long contextUnitId) {
    int days = ReadArgs.clampDays(args.get("days"), DEFAULT_DAYS, MAX_DAYS);
    LocalDate to = LocalDate.now();
    LocalDate from = to.minusDays(days - 1L);
    LivestockStats stats = livestock.livestockStats(farmId, from, to);
    if (stats.avgDailyGainG() == null) {
      return "Pas assez de pesées sur les " + days + " dernier(s) jour(s) pour calculer le GMQ.";
    }
    return "GMQ moyen : "
        + Math.round(stats.avgDailyGainG())
        + " g/jour sur les "
        + days
        + " dernier(s) jour(s).";
  }
}
