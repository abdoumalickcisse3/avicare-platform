package com.avicare.assistant.tool;

import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.domain.UnitStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Shared lot resolution for the poultry tools. The model isn't asked to name the lot (it can't
 * guess an id reliably); instead the target lot is the one the assistant was opened from, else the
 * farm's single active lot, else ambiguous → the tool asks "Sur quel lot ?".
 */
@Component
public class LivestockUnits {

  private final LivestockFacade livestock;

  public LivestockUnits(LivestockFacade livestock) {
    this.livestock = livestock;
  }

  public List<ProductionUnitInfo> active(Long farmId) {
    return livestock.listFarmUnits(farmId).stream()
        .filter(u -> u.status() == UnitStatus.ACTIVE)
        .toList();
  }

  /**
   * The target lot from the opened-lot context or a single active lot; empty when ambiguous/none.
   */
  public Optional<ProductionUnitInfo> resolve(Long farmId, Long contextUnitId) {
    List<ProductionUnitInfo> active = active(farmId);
    if (contextUnitId != null) {
      return active.stream().filter(u -> u.id().equals(contextUnitId)).findFirst();
    }
    return active.size() == 1 ? Optional.of(active.get(0)) : Optional.empty();
  }

  public boolean hasMultipleActive(Long farmId) {
    return active(farmId).size() > 1;
  }
}
