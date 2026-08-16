package com.avicare.notification.detect;

import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Maps commercial alert conditions ({@link CommercialFacade#overdueInvoices(Long)} and {@link
 * CommercialFacade#clientsOverCredit(Long)}) to {@link DetectedCondition}s (Sprint C1). Owns {@code
 * INVOICE_OVERDUE} and {@code CREDIT_EXCEEDED}. No business logic — the facade owns detection.
 */
@Component
@RequiredArgsConstructor
public class CommercialDetector implements AlertDetector {

  private final CommercialFacade commercialFacade;

  @Override
  public Set<NotificationCategory> categories() {
    return Set.of(NotificationCategory.INVOICE_OVERDUE, NotificationCategory.CREDIT_EXCEEDED);
  }

  @Override
  public List<DetectedCondition> detect(Long farmId) {
    List<DetectedCondition> out = new ArrayList<>();
    commercialFacade
        .overdueInvoices(farmId)
        .forEach(
            i ->
                out.add(
                    new DetectedCondition(
                        NotificationCategory.INVOICE_OVERDUE,
                        NotificationSeverity.WARNING,
                        "INVOICE_OVERDUE:invoice:" + i.invoiceId(),
                        "Facture en retard : " + i.clientName(),
                        "La facture du client « "
                            + i.clientName()
                            + " » a "
                            + i.daysOverdue()
                            + " jour(s) de retard ("
                            + i.outstandingXof()
                            + " FCFA restants).",
                        Map.of("invoiceId", i.invoiceId(), "clientId", i.clientId()))));
    commercialFacade
        .clientsOverCredit(farmId)
        .forEach(
            c ->
                out.add(
                    new DetectedCondition(
                        NotificationCategory.CREDIT_EXCEEDED,
                        NotificationSeverity.WARNING,
                        "CREDIT_EXCEEDED:client:" + c.clientId(),
                        "Encours dépassé : " + c.clientName(),
                        "L'encours du client « "
                            + c.clientName()
                            + " » ("
                            + c.currentBalanceXof()
                            + " FCFA) dépasse sa limite de crédit ("
                            + c.creditLimitXof()
                            + " FCFA).",
                        Map.of("clientId", c.clientId()))));
    return out;
  }
}
