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
 * Consult recent mortality on the farm over a window (default 7 days). Read-only: hits {@link
 * LivestockFacade#livestockStats} and returns the death count for the model to phrase.
 */
@Component
public class MortalityQueryTool implements ReadTool {

  private static final int DEFAULT_DAYS = 7;
  private static final int MAX_DAYS = 365;

  private final LivestockFacade livestock;

  public MortalityQueryTool(LivestockFacade livestock) {
    this.livestock = livestock;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "MORTALITY_QUERY",
        "Consulter la mortalité récente de la ferme sur une période (par défaut 7 derniers jours).",
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
    int days = clampDays(args.get("days"));
    LocalDate to = LocalDate.now();
    LocalDate from = to.minusDays(days - 1L);
    LivestockStats stats = livestock.livestockStats(farmId, from, to);
    return stats.deaths()
        + " sujet(s) mort(s) sur les "
        + days
        + " dernier(s) jour(s) (du "
        + from
        + " au "
        + to
        + ").";
  }

  private static int clampDays(Object raw) {
    if (raw instanceof Number n && n.intValue() > 0) {
      return Math.min(n.intValue(), MAX_DAYS);
    }
    try {
      int parsed = raw == null ? DEFAULT_DAYS : Integer.parseInt(raw.toString().trim());
      return parsed > 0 ? Math.min(parsed, MAX_DAYS) : DEFAULT_DAYS;
    } catch (NumberFormatException e) {
      return DEFAULT_DAYS;
    }
  }
}
