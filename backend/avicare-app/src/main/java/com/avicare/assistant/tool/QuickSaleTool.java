package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asInt;
import static com.avicare.assistant.tool.ToolArgs.asIntOrNull;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.ProductType;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Prepare a direct sale of farm production (live broilers from a lot, or eggs from the farm pool).
 * The dry-run checks real availability so the confirmation card shows the true stock consequence
 * and refuses to over-sell before the human even confirms. The client (spoken name, else walk-in)
 * and the price are carried through and confirmed on the mobile card; the write is the existing
 * sale endpoint.
 */
@Component
public class QuickSaleTool implements AssistantTool {

  private final LivestockFacade livestock;
  private final LivestockUnits units;

  public QuickSaleTool(LivestockFacade livestock, LivestockUnits units) {
    this.livestock = livestock;
    this.units = units;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "QUICK_SALE",
        "Enregistrer une vente directe de production : des poulets vivants d'un lot, ou des œufs.",
        List.of(
            ToolParam.required(
                "product",
                ToolParam.Type.STRING,
                "Produit vendu : « broiler » (poulets vivants) ou « eggs » (œufs)"),
            ToolParam.required("quantity", ToolParam.Type.INTEGER, "Quantité vendue"),
            ToolParam.optional(
                "unitPriceXof", ToolParam.Type.INTEGER, "Prix unitaire en F CFA, si dit"),
            ToolParam.optional(
                "clientName", ToolParam.Type.STRING, "Nom du client, sinon client de passage")));
  }

  @Override
  public String requiredPermission() {
    return "commercial:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    int quantity = asInt(args.get("quantity"));
    if (quantity < 1) {
      return InterpretResponse.clarification("Quelle quantité vendez-vous ?");
    }
    boolean eggs = isEggs(asString(args.get("product")));
    ProductType type = eggs ? ProductType.EGGS : ProductType.BROILER;

    Long unitId = null;
    String unitName = null;
    if (!eggs) {
      Optional<ProductionUnitInfo> unit = units.resolve(farmId, contextUnitId);
      if (unit.isEmpty()) {
        return InterpretResponse.clarification(
            units.hasMultipleActive(farmId) ? "Vente de quel lot ?" : "Aucun lot actif trouvé.");
      }
      unitId = unit.get().id();
      unitName = unit.get().name();
    }

    long available = livestock.productionAvailable(farmId, type, unitId);
    if (quantity > available) {
      return InterpretResponse.clarification(
          "Stock insuffisant : seulement " + available + " " + label(eggs) + " disponible(s).");
    }

    Integer unitPrice = asIntOrNull(args.get("unitPriceXof"));
    String clientName = asString(args.get("clientName"));

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("productType", type.name());
    fields.put("quantity", quantity);
    fields.put("availableBefore", available);
    fields.put("availableAfter", available - quantity);
    if (unitId != null) {
      fields.put("unitId", unitId);
      fields.put("unitName", unitName);
    }
    if (unitPrice != null) {
      fields.put("unitPriceXof", unitPrice);
    }
    if (clientName != null) {
      fields.put("clientName", clientName);
    }
    String where = unitName != null ? " du lot " + unitName : "";
    return InterpretResponse.draft(
        "QUICK_SALE",
        unitId,
        fields,
        "Vente de "
            + quantity
            + " "
            + label(eggs)
            + where
            + " — stock "
            + available
            + " → "
            + (available - quantity)
            + ".");
  }

  private static boolean isEggs(String product) {
    if (product == null) {
      return false;
    }
    String p = product.toLowerCase(Locale.ROOT);
    return p.contains("oeuf") || p.contains("œuf") || p.contains("egg");
  }

  private static String label(boolean eggs) {
    return eggs ? "œufs" : "poulets";
  }
}
