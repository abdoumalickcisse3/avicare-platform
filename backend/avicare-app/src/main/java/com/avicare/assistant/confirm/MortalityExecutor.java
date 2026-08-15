package com.avicare.assistant.confirm;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.api.LivestockFacade;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Server-side executor for a confirmed MORTALITY draft. */
@Component
@RequiredArgsConstructor
class MortalityExecutor implements DraftExecutor {

  private final LivestockFacade livestock;

  @Override
  public String action() {
    return "MORTALITY";
  }

  @Override
  public void execute(Long farmId, Long userId, Map<String, Object> fields) {
    Long unitId = ConfirmFields.asLong(fields, "unitId");
    int count = ConfirmFields.asInt(fields, "count");
    if (unitId == null || count < 1) {
      throw new BusinessRuleException(
          "ASSISTANT_DRAFT_INVALID", "Mortality draft is missing its lot or count.");
    }
    livestock.recordMortality(
        farmId, unitId, count, ConfirmFields.asString(fields, "reason"), userId);
  }
}
