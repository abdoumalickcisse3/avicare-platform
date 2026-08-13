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
 * Consult average daily feed consumption over a window (default 7 days). Read-only: hits {@link
 * LivestockFacade#livestockStats}.
 */
@Component
public class FeedConsumptionTool implements ReadTool {

  private static final int DEFAULT_DAYS = 7;
  private static final int MAX_DAYS = 365;

  private final LivestockFacade livestock;

  public FeedConsumptionTool(LivestockFacade livestock) {
    this.livestock = livestock;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "FEED_CONSUMPTION",
        "Consulter la consommation d'aliment de la ferme : quantité moyenne par jour sur une"
            + " période (par défaut 7 derniers jours).",
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
    if (stats.dailyFeedKg() == null) {
      return "Aucune consommation d'aliment enregistrée sur les " + days + " dernier(s) jour(s).";
    }
    return "Consommation moyenne d'aliment : "
        + Math.round(stats.dailyFeedKg())
        + " kg/jour sur les "
        + days
        + " dernier(s) jour(s).";
  }
}
