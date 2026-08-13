package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolSpec;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.dto.CommercialStats;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Consult the farm's overdue receivables and invoices left to collect. Read-only: hits {@link
 * CommercialFacade#commercialStats} (snapshot KPIs, period-independent).
 */
@Component
public class OverdueInvoicesTool implements ReadTool {

  private final CommercialFacade commercial;

  public OverdueInvoicesTool(CommercialFacade commercial) {
    this.commercial = commercial;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "OVERDUE_INVOICES",
        "Consulter les impayés : montant des factures en retard de paiement et nombre de factures"
            + " à encaisser.",
        List.of());
  }

  @Override
  public String requiredPermission() {
    return "commercial:read";
  }

  @Override
  public String read(Long farmId, Map<String, Object> args, Long contextUnitId) {
    LocalDate to = LocalDate.now();
    CommercialStats stats = commercial.commercialStats(farmId, to.minusDays(29), to);
    if (stats.overdueXof() == 0 && stats.invoicesToCollect() == 0) {
      return "Aucune facture en retard ni à encaisser.";
    }
    return stats.overdueXof()
        + " F CFA en retard de paiement ; "
        + stats.invoicesToCollect()
        + " facture(s) à encaisser au total.";
  }
}
