package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolSpec;
import com.avicare.finance.api.FarmPnl;
import com.avicare.finance.api.FinanceFacade;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Consult the farm's profit &amp; loss (revenue, expenses, margin). Read-only: hits {@link
 * FinanceFacade#farmPnl} — the same figures as the finance dashboard — and returns them for the
 * model to phrase.
 */
@Component
public class FarmPnlTool implements ReadTool {

  private final FinanceFacade finance;

  public FarmPnlTool(FinanceFacade finance) {
    this.finance = finance;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "FARM_PNL",
        "Consulter le résultat financier de la ferme : revenus, dépenses et marge.",
        List.of());
  }

  @Override
  public String requiredPermission() {
    return "finance:read";
  }

  @Override
  public String read(Long farmId, Map<String, Object> args, Long contextUnitId) {
    FarmPnl pnl = finance.farmPnl(farmId);
    return "Revenus : "
        + pnl.revenueXof()
        + " F CFA ; dépenses : "
        + pnl.expenseXof()
        + " F CFA ; marge : "
        + pnl.marginXof()
        + " F CFA.";
  }
}
