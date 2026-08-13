package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asDoubleOrNull;
import static com.avicare.assistant.tool.ToolArgs.asInt;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Broiler daily entry: today's mortality, feed (kg), water (L) and free observations. */
@Component
public class DailyRecordTool implements AssistantTool {

  private final LivestockUnits units;

  public DailyRecordTool(LivestockUnits units) {
    this.units = units;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "DAILY_RECORD",
        "Saisie journalière d'un lot de chair : mortalité du jour, aliment (kg), eau (L),"
            + " observations.",
        List.of(
            ToolParam.optional("mortalityCount", ToolParam.Type.INTEGER, "Mortalité du jour"),
            ToolParam.optional("feedKg", ToolParam.Type.NUMBER, "Aliment distribué, en kg"),
            ToolParam.optional("waterL", ToolParam.Type.NUMBER, "Eau consommée, en litres"),
            ToolParam.optional(
                "observations", ToolParam.Type.STRING, "Observation libre éventuelle")));
  }

  @Override
  public String requiredPermission() {
    return "poultry:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    int mortality = asInt(args.get("mortalityCount"));
    Double feedKg = asDoubleOrNull(args.get("feedKg"));
    Double waterL = asDoubleOrNull(args.get("waterL"));
    String observations = asString(args.get("observations"));
    if (mortality == 0 && feedKg == null && waterL == null && observations == null) {
      return InterpretResponse.clarification("Que voulez-vous enregistrer pour aujourd'hui ?");
    }
    Optional<ProductionUnitInfo> unit = units.resolve(farmId, contextUnitId);
    if (unit.isEmpty()) {
      return InterpretResponse.clarification(
          units.hasMultipleActive(farmId) ? "Sur quel lot ?" : "Aucun lot actif trouvé.");
    }
    ProductionUnitInfo u = unit.get();

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("mortalityCount", mortality);
    fields.put("unitId", u.id());
    fields.put("unitName", u.name());
    if (feedKg != null) {
      fields.put("feedKg", feedKg);
    }
    if (waterL != null) {
      fields.put("waterL", waterL);
    }
    if (observations != null) {
      fields.put("observations", observations);
    }
    return InterpretResponse.draft(
        "DAILY_RECORD",
        u.id(),
        fields,
        "Saisie du jour sur le lot "
            + u.name()
            + " : mortalité "
            + mortality
            + (feedKg != null ? ", aliment " + feedKg + " kg" : "")
            + (waterL != null ? ", eau " + waterL + " L" : "")
            + ".");
  }
}
