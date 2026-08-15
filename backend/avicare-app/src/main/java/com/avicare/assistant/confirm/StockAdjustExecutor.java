package com.avicare.assistant.confirm;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.api.InventoryFacade;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Server-side executor for a confirmed ADJUST_STOCK draft. */
@Component
@RequiredArgsConstructor
class StockAdjustExecutor implements DraftExecutor {

  private final InventoryFacade inventory;

  @Override
  public String action() {
    return "ADJUST_STOCK";
  }

  @Override
  public void execute(Long farmId, Long userId, Map<String, Object> fields) {
    Long stockItemId = ConfirmFields.asLong(fields, "stockItemId");
    long delta = ConfirmFields.asLongOr(fields, "delta", 0);
    if (stockItemId == null || delta == 0) {
      throw new BusinessRuleException(
          "ASSISTANT_DRAFT_INVALID", "Stock-adjust draft is missing its item or delta.");
    }
    inventory.recordStockMovement(farmId, stockItemId, delta, userId);
  }
}
