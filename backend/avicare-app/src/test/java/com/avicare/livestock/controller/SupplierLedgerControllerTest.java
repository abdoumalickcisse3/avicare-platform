package com.avicare.livestock.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.common.tenancy.context.TenantData;
import com.avicare.livestock.controller.dto.SupplierLedgerEntryRequest;
import com.avicare.livestock.controller.dto.SupplierStatementResponse;
import com.avicare.livestock.domain.LedgerDirection;
import com.avicare.livestock.domain.LedgerSource;
import com.avicare.livestock.domain.SupplierLedgerEntry;
import com.avicare.livestock.inventory.SupplierLedgerCommand;
import com.avicare.livestock.inventory.SupplierLedgerService;
import com.avicare.livestock.inventory.SupplierStatementLine;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/** Le contrôleur ne fait que traduire : on vérifie qu'il traduit juste. */
class SupplierLedgerControllerTest {

  private final SupplierLedgerService service = Mockito.mock(SupplierLedgerService.class);
  private final SupplierLedgerController controller = new SupplierLedgerController(service);

  @BeforeEach
  void bindTenancy() {
    TenancyContext.set(new TenantData(42L, List.of(7L), false));
  }

  @AfterEach
  void clearTenancy() {
    TenancyContext.clear();
  }

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

    verify(service).deleteEntry(7L, 3L, 5L);
  }

  /**
   * {@code toCommand} maps an absent {@code notifySupplier} to {@code true}. This is the default
   * that decides whether an unspecified caller messages a third party, and it had no test on any
   * layer before this one.
   */
  @Test
  void anAbsentNotifySupplierDefaultsToTrue() {
    SupplierLedgerEntryRequest request =
        new SupplierLedgerEntryRequest(
            100_000L, LocalDate.of(2026, 9, 5), "Versement", "CASH", null, null, null);
    when(service.recordPayment(eq(7L), eq(3L), any(), anyLong())).thenReturn(entry());

    controller.recordPayment(7L, 3L, request);

    ArgumentCaptor<SupplierLedgerCommand> captor =
        ArgumentCaptor.forClass(SupplierLedgerCommand.class);
    verify(service).recordPayment(eq(7L), eq(3L), captor.capture(), anyLong());
    assertThat(captor.getValue().notifySupplier()).isTrue();
  }

  @Test
  void anExplicitFalseNotifySupplierStaysFalse() {
    SupplierLedgerEntryRequest request =
        new SupplierLedgerEntryRequest(
            100_000L, LocalDate.of(2026, 9, 5), "Versement", "CASH", null, null, false);
    when(service.recordPayment(eq(7L), eq(3L), any(), anyLong())).thenReturn(entry());

    controller.recordPayment(7L, 3L, request);

    ArgumentCaptor<SupplierLedgerCommand> captor =
        ArgumentCaptor.forClass(SupplierLedgerCommand.class);
    verify(service).recordPayment(eq(7L), eq(3L), captor.capture(), anyLong());
    assertThat(captor.getValue().notifySupplier()).isFalse();
  }

  private static SupplierLedgerEntry entry() {
    SupplierLedgerEntry e = new SupplierLedgerEntry();
    e.setId(9L);
    return e;
  }
}
