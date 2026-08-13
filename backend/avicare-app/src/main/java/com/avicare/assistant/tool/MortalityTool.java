package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asInt;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Record a mortality on a lot. Read-only dry-run: resolves the lot and shows the headcount after.
 */
@Component
public class MortalityTool implements AssistantTool {

  private final LivestockUnits units;

  public MortalityTool(LivestockUnits units) {
    this.units = units;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "MORTALITY",
        "Enregistrer une mortalité : des sujets (poulets) sont morts sur un lot.",
        List.of(
            ToolParam.required("count", ToolParam.Type.INTEGER, "Nombre de sujets morts"),
            ToolParam.optional("reason", ToolParam.Type.STRING, "Cause éventuelle")));
  }

  @Override
  public String requiredPermission() {
    return "poultry:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    int count = asInt(args.get("count"));
    if (count < 1) {
      return InterpretResponse.clarification("Combien de sujets ?");
    }
    Optional<ProductionUnitInfo> unit = units.resolve(farmId, contextUnitId);
    if (unit.isEmpty()) {
      return InterpretResponse.clarification(
          units.hasMultipleActive(farmId) ? "Sur quel lot ?" : "Aucun lot actif trouvé.");
    }
    ProductionUnitInfo u = unit.get();
    int after = Math.max(0, u.currentCount() - count);
    String reason = asString(args.get("reason"));

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("count", count);
    fields.put("unitId", u.id());
    fields.put("unitName", u.name());
    fields.put("countAfter", after);
    if (reason != null) {
      fields.put("reason", reason);
    }
    return InterpretResponse.draft(
        "MORTALITY",
        u.id(),
        fields,
        "Mortalité de "
            + count
            + " sujets sur le lot "
            + u.name()
            + ". Effectif après : "
            + after
            + ".");
  }
}
