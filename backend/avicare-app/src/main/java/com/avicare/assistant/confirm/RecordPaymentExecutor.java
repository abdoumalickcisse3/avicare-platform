package com.avicare.assistant.confirm;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.livestock.commercial.CommercialFacade;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Server-side executor for a confirmed RECORD_PAYMENT draft. */
@Component
@RequiredArgsConstructor
class RecordPaymentExecutor implements DraftExecutor {

  private final CommercialFacade commercial;

  @Override
  public String action() {
    return "RECORD_PAYMENT";
  }

  @Override
  public void execute(Long farmId, Long userId, Map<String, Object> fields) {
    Long invoiceId = ConfirmFields.asLong(fields, "invoiceId");
    long amountXof = ConfirmFields.asLongOr(fields, "amountXof", 0);
    if (invoiceId == null || amountXof < 1) {
      throw new BusinessRuleException(
          "ASSISTANT_DRAFT_INVALID", "Payment draft is missing its invoice or amount.");
    }
    commercial.recordPayment(
        farmId, invoiceId, amountXof, ConfirmFields.asString(fields, "method"), userId);
  }
}
