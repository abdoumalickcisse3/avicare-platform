package com.avicare.assistant.confirm;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.api.LivestockFacade;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Server-side executor for a confirmed CREATE_LOT draft: creates the broiler batch. */
@Component
@RequiredArgsConstructor
class CreateLotExecutor implements DraftExecutor {

  private final LivestockFacade livestock;

  @Override
  public String action() {
    return "CREATE_LOT";
  }

  @Override
  public void execute(Long farmId, Long userId, Map<String, Object> fields) {
    Long breedId = ConfirmFields.asLong(fields, "breedId");
    int count = ConfirmFields.asInt(fields, "initialCount");
    if (breedId == null || count < 1) {
      throw new BusinessRuleException(
          "ASSISTANT_DRAFT_INVALID", "Create-lot draft is missing its breed or count.");
    }
    // startDate null → defaults to today in the facade.
    livestock.createBroilerBatch(
        farmId, breedId, ConfirmFields.asString(fields, "name"), count, null, userId);
  }
}
