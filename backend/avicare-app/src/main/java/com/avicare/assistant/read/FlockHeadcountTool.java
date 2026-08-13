package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolSpec;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.domain.UnitStatus;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Consult the current headcount of the farm's active lots. Read-only: hits {@link
 * LivestockFacade#listFarmUnits} and returns a per-lot breakdown plus the total for the model to
 * phrase.
 */
@Component
public class FlockHeadcountTool implements ReadTool {

  private final LivestockFacade livestock;

  public FlockHeadcountTool(LivestockFacade livestock) {
    this.livestock = livestock;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "FLOCK_HEADCOUNT",
        "Consulter l'effectif actuel (nombre de sujets) des lots actifs de la ferme.",
        List.of());
  }

  @Override
  public String requiredPermission() {
    return "poultry:read";
  }

  @Override
  public String read(Long farmId, Map<String, Object> args, Long contextUnitId) {
    List<ProductionUnitInfo> active =
        livestock.listFarmUnits(farmId).stream()
            .filter(u -> u.status() == UnitStatus.ACTIVE)
            .toList();
    if (active.isEmpty()) {
      return "Aucun lot actif sur cette ferme.";
    }
    long total = active.stream().mapToLong(ProductionUnitInfo::currentCount).sum();
    String perLot =
        active.stream()
            .map(u -> u.name() + " : " + u.currentCount() + " sujets")
            .collect(Collectors.joining("; "));
    return perLot + ". Total : " + total + " sujets.";
  }
}
