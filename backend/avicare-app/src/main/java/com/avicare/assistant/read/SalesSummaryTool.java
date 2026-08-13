package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolParam;
import com.avicare.assistant.tool.ToolSpec;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.dto.CommercialStats;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Consult the farm's sales revenue over a window (default 30 days). Read-only: hits {@link
 * CommercialFacade#commercialStats} and returns the period revenue for the model to phrase.
 */
@Component
public class SalesSummaryTool implements ReadTool {

  private static final int DEFAULT_DAYS = 30;
  private static final int MAX_DAYS = 365;

  private final CommercialFacade commercial;

  public SalesSummaryTool(CommercialFacade commercial) {
    this.commercial = commercial;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "SALES_SUMMARY",
        "Consulter le chiffre d'affaires (ventes) de la ferme sur une période (par défaut 30"
            + " derniers jours).",
        List.of(
            ToolParam.optional(
                "days", ToolParam.Type.INTEGER, "Nombre de jours à couvrir, défaut 30")));
  }

  @Override
  public String requiredPermission() {
    return "commercial:read";
  }

  @Override
  public String read(Long farmId, Map<String, Object> args, Long contextUnitId) {
    int days = clampDays(args.get("days"));
    LocalDate to = LocalDate.now();
    LocalDate from = to.minusDays(days - 1L);
    CommercialStats stats = commercial.commercialStats(farmId, from, to);
    return "Chiffre d'affaires des "
        + days
        + " dernier(s) jour(s) : "
        + stats.revenueXof()
        + " F CFA (du "
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
