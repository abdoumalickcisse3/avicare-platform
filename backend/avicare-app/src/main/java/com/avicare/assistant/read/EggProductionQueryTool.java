package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolParam;
import com.avicare.assistant.tool.ToolSpec;
import com.avicare.common.api.dto.DayValue;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.LivestockStats;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Consult egg production over a window (default 7 days): total eggs laid and the average laying
 * rate. Read-only: hits {@link LivestockFacade#livestockStats}.
 */
@Component
public class EggProductionQueryTool implements ReadTool {

  private static final int DEFAULT_DAYS = 7;
  private static final int MAX_DAYS = 365;

  private final LivestockFacade livestock;

  public EggProductionQueryTool(LivestockFacade livestock) {
    this.livestock = livestock;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "EGG_PRODUCTION_QUERY",
        "Consulter la production d'œufs sur une période (par défaut 7 derniers jours) : nombre"
            + " d'œufs pondus et taux de ponte moyen.",
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
    long totalEggs = stats.layingSeries().stream().mapToLong(DayValue::valueXof).sum();
    if (totalEggs == 0 && stats.layingRate() == null) {
      return "Aucune ponte enregistrée sur les " + days + " dernier(s) jour(s).";
    }
    String rate =
        stats.layingRate() != null
            ? " (taux de ponte moyen " + Math.round(stats.layingRate()) + " %)"
            : "";
    return totalEggs + " œuf(s) pondu(s) sur les " + days + " dernier(s) jour(s)" + rate + ".";
  }
}
