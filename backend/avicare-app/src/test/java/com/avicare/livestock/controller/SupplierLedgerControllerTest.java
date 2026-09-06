package com.avicare.livestock.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.livestock.controller.dto.SupplierStatementResponse;
import com.avicare.livestock.domain.LedgerDirection;
import com.avicare.livestock.domain.LedgerSource;
import com.avicare.livestock.inventory.SupplierLedgerService;
import com.avicare.livestock.inventory.SupplierStatementLine;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Le contrôleur ne fait que traduire : on vérifie qu'il traduit juste. */
class SupplierLedgerControllerTest {

  private final SupplierLedgerService service = Mockito.mock(SupplierLedgerService.class);
  private final SupplierLedgerController controller = new SupplierLedgerController(service);

  @Test
  void theStatementCarriesTheBalanceAndTheRunningColumn() {
    when(service.statement(7L, 3L))
        .thenReturn(
            List.of(
                new SupplierStatementLine(
                    1L,
                    LocalDate.of(2026, 9, 1),
                    LedgerDirection.DEBIT,
                    LedgerSource.PURCHASE_ORDER,
                    500_000L,
                    "Bon d'achat BA-12",
                    null,
                    null,
                    88L,
                    500_000L)));
    when(service.balance(7L, 3L)).thenReturn(500_000L);

    SupplierStatementResponse body = controller.statement(7L, 3L).data();

    assertThat(body.balanceXof()).isEqualTo(500_000L);
    assertThat(body.entries())
        .singleElement()
        .satisfies(
            e -> {
              assertThat(e.direction()).isEqualTo("DEBIT");
              assertThat(e.source()).isEqualTo("PURCHASE_ORDER");
              assertThat(e.runningBalanceXof()).isEqualTo(500_000L);
            });
  }

  @Test
  void deletingAnEntryReachesTheService() {
    controller.deleteEntry(7L, 3L, 5L);

    verify(service).deleteEntry(7L, 5L);
  }
}
