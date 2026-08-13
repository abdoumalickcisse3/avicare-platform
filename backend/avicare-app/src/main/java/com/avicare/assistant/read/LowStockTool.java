package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolSpec;
import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.LowStockInfo;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Consult which articles have fallen at or below their alert threshold. Read-only: hits {@link
 * InventoryFacade#lowStock}.
 */
@Component
public class LowStockTool implements ReadTool {

  private final InventoryFacade inventory;

  public LowStockTool(InventoryFacade inventory) {
    this.inventory = inventory;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "LOW_STOCK",
        "Consulter les articles dont le stock est bas (au seuil d'alerte ou en dessous).",
        List.of());
  }

  @Override
  public String requiredPermission() {
    return "inventory:read";
  }

  @Override
  public String read(Long farmId, Map<String, Object> args, Long contextUnitId) {
    List<LowStockInfo> low = inventory.lowStock(farmId);
    if (low.isEmpty()) {
      return "Aucun article sous le seuil d'alerte.";
    }
    return low.stream().limit(8).map(LowStockTool::line).collect(Collectors.joining("; "));
  }

  private static String line(LowStockInfo s) {
    String unit = s.unit() != null ? " " + s.unit() : "";
    String name = s.label() != null ? s.label() : s.articleKey();
    return name + " : " + s.currentQuantity() + unit + " (seuil " + s.alertThreshold() + unit + ")";
  }
}
