package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asIntList;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Record a weighing sample (individual weights, grams) on a lot. */
@Component
public class WeighingTool implements AssistantTool {

  private final LivestockUnits units;

  public WeighingTool(LivestockUnits units) {
    this.units = units;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "WEIGHING",
        "Enregistrer une pesée : les poids individuels de plusieurs sujets, en grammes.",
        List.of(
            ToolParam.required(
                "weights", ToolParam.Type.INTEGER_ARRAY, "Poids individuels en grammes"),
            ToolParam.optional("notes", ToolParam.Type.STRING, "Note éventuelle")));
  }

  @Override
  public String requiredPermission() {
    return "poultry:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    List<Integer> weights = asIntList(args.get("weights"));
    if (weights.isEmpty()) {
      return InterpretResponse.clarification(
          "Quels poids ? Dites par exemple : « 1200, 1150, 1300 ».");
    }
    Optional<ProductionUnitInfo> unit = units.resolve(farmId, contextUnitId);
    if (unit.isEmpty()) {
      return InterpretResponse.clarification(
          units.hasMultipleActive(farmId) ? "Sur quel lot ?" : "Aucun lot actif trouvé.");
    }
    ProductionUnitInfo u = unit.get();
    int avg = (int) Math.round(weights.stream().mapToInt(Integer::intValue).average().orElse(0));
    String notes = asString(args.get("notes"));

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("weights", weights);
    fields.put("unitId", u.id());
    fields.put("unitName", u.name());
    fields.put("sampleSize", weights.size());
    fields.put("avgWeightG", avg);
    if (notes != null) {
      fields.put("notes", notes);
    }
    return InterpretResponse.draft(
        "WEIGHING",
        u.id(),
        fields,
        "Pesée de "
            + weights.size()
            + " sujets sur le lot "
            + u.name()
            + ", poids moyen "
            + avg
            + " g.");
  }
}
