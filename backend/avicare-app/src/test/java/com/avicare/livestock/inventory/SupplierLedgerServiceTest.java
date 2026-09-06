package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.LedgerDirection;
import com.avicare.livestock.domain.LedgerSource;
import com.avicare.livestock.domain.Supplier;
import com.avicare.livestock.domain.SupplierLedgerEntry;
import com.avicare.livestock.repository.SupplierLedgerEntryRepository;
import com.avicare.livestock.repository.SupplierRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

class SupplierLedgerServiceTest {

  private SupplierLedgerEntryRepository ledgerRepository;
  private SupplierRepository supplierRepository;
  private SupplierNotifier supplierNotifier;
  private SupplierLedgerService service;

  private static final Long FARM = 7L;
  private static final Long SUPPLIER = 3L;
  private static final Long USER = 42L;

  @BeforeEach
  void setUp() {
    ledgerRepository = Mockito.mock(SupplierLedgerEntryRepository.class);
    supplierRepository = Mockito.mock(SupplierRepository.class);
    supplierNotifier = Mockito.mock(SupplierNotifier.class);
    service = new SupplierLedgerService(ledgerRepository, supplierRepository, supplierNotifier);

    Supplier supplier = new Supplier();
    supplier.setId(SUPPLIER);
    supplier.setFarmId(FARM);
    supplier.setCommercialName("Provende du Sahel");
    lenient()
        .when(supplierRepository.findByFarmIdAndId(FARM, SUPPLIER))
        .thenReturn(Optional.of(supplier));
    lenient()
        .when(ledgerRepository.save(any(SupplierLedgerEntry.class)))
        .thenAnswer(inv -> inv.getArgument(0));
  }

  private static SupplierLedgerEntry line(
      long id, LocalDate date, LedgerDirection direction, long amount, LedgerSource source) {
    SupplierLedgerEntry e = new SupplierLedgerEntry();
    e.setId(id);
    e.setFarmId(FARM);
    e.setSupplierId(SUPPLIER);
    e.setEntryDate(date);
    e.setDirection(direction);
    e.setAmountXof(amount);
    e.setSource(source);
    return e;
  }

  private static SupplierLedgerCommand cmd(long amount) {
    return new SupplierLedgerCommand(
        amount, LocalDate.of(2026, 9, 5), "Versement", "CASH", null, null, true);
  }

  @Test
  void recordsAPaymentAsACreditWrittenByHand() {
    service.recordPayment(FARM, SUPPLIER, cmd(200_000L), USER);

    ArgumentCaptor<SupplierLedgerEntry> saved = ArgumentCaptor.forClass(SupplierLedgerEntry.class);
    verify(ledgerRepository).save(saved.capture());
    assertThat(saved.getValue().getDirection()).isEqualTo(LedgerDirection.CREDIT);
    assertThat(saved.getValue().getSource()).isEqualTo(LedgerSource.MANUAL);
    assertThat(saved.getValue().getAmountXof()).isEqualTo(200_000L);
    assertThat(saved.getValue().getCreatedBy()).isEqualTo(USER);
  }

  @Test
  void recordsAManualChargeAsADebit() {
    service.recordCharge(FARM, SUPPLIER, cmd(240_000L), USER);

    ArgumentCaptor<SupplierLedgerEntry> saved = ArgumentCaptor.forClass(SupplierLedgerEntry.class);
    verify(ledgerRepository).save(saved.capture());
    assertThat(saved.getValue().getDirection()).isEqualTo(LedgerDirection.DEBIT);
    assertThat(saved.getValue().getSource()).isEqualTo(LedgerSource.MANUAL);
  }

  @Test
  void refusesAnAmountThatIsNotStrictlyPositive() {
    assertThatThrownBy(() -> service.recordPayment(FARM, SUPPLIER, cmd(0L), USER))
        .isInstanceOf(ValidationException.class);
    verify(ledgerRepository, never()).save(any());
  }

  @Test
  void refusesASupplierOfAnotherFarm() {
    when(supplierRepository.findByFarmIdAndId(FARM, 99L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.recordPayment(FARM, 99L, cmd(1_000L), USER))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void buildsAStatementWithARunningBalance() {
    when(ledgerRepository.findByFarmIdAndSupplierIdOrderByEntryDateAscIdAsc(FARM, SUPPLIER))
        .thenReturn(
            List.of(
                line(
                    1L,
                    LocalDate.of(2026, 9, 1),
                    LedgerDirection.DEBIT,
                    500_000L,
                    LedgerSource.PURCHASE_ORDER),
                line(
                    2L,
                    LocalDate.of(2026, 9, 3),
                    LedgerDirection.CREDIT,
                    200_000L,
                    LedgerSource.MANUAL),
                line(
                    3L,
                    LocalDate.of(2026, 9, 4),
                    LedgerDirection.DEBIT,
                    100_000L,
                    LedgerSource.MANUAL)));

    List<SupplierStatementLine> statement = service.statement(FARM, SUPPLIER);

    assertThat(statement)
        .extracting(SupplierStatementLine::runningBalanceXof)
        .containsExactly(500_000L, 300_000L, 400_000L);
  }

  @Test
  void includesASupplierWithNoLedgerEntriesAtZero() {
    Supplier withEntries = new Supplier();
    withEntries.setId(SUPPLIER);
    withEntries.setFarmId(FARM);
    withEntries.setCommercialName("Provende du Sahel");

    Supplier withoutEntries = new Supplier();
    withoutEntries.setId(4L);
    withoutEntries.setFarmId(FARM);
    withoutEntries.setCommercialName("Cabinet Véto Baobab");

    when(supplierRepository.findByFarmIdAndActiveTrueOrderByCommercialName(FARM))
        .thenReturn(List.of(withEntries, withoutEntries));
    when(ledgerRepository.balancesBySupplier(FARM))
        .thenReturn(List.<Object[]>of(new Object[] {SUPPLIER, 300_000L}));

    List<SupplierBalance> balances = service.balances(FARM);

    assertThat(balances)
        .extracting(SupplierBalance::supplierId, SupplierBalance::balanceXof)
        .containsExactly(tuple(SUPPLIER, 300_000L), tuple(4L, 0L));
  }

  @Test
  void reportsANegativeBalanceWithoutClampingToZero() {
    Supplier supplier = new Supplier();
    supplier.setId(SUPPLIER);
    supplier.setFarmId(FARM);
    supplier.setCommercialName("Provende du Sahel");

    when(supplierRepository.findByFarmIdAndActiveTrueOrderByCommercialName(FARM))
        .thenReturn(List.of(supplier));
    when(ledgerRepository.balancesBySupplier(FARM))
        .thenReturn(List.<Object[]>of(new Object[] {SUPPLIER, -150_000L}));

    List<SupplierBalance> balances = service.balances(FARM);

    assertThat(balances).extracting(SupplierBalance::balanceXof).containsExactly(-150_000L);
  }

  @Test
  void recordsThePurchaseOrderDebitOnlyOnce() {
    when(ledgerRepository.existsByPurchaseOrderId(88L)).thenReturn(true);

    service.recordPurchaseOrderDebit(
        FARM, SUPPLIER, 88L, "BA-12", 400_000L, LocalDate.of(2026, 9, 5), USER);

    verify(ledgerRepository, never()).save(any());
  }

  @Test
  void deletesAManualLine() {
    SupplierLedgerEntry manual =
        line(5L, LocalDate.of(2026, 9, 5), LedgerDirection.CREDIT, 10_000L, LedgerSource.MANUAL);
    when(ledgerRepository.findByFarmIdAndId(FARM, 5L)).thenReturn(Optional.of(manual));

    service.deleteEntry(FARM, SUPPLIER, 5L);

    verify(ledgerRepository).delete(manual);
  }

  @Test
  void refusesToDeleteALineThroughTheWrongSupplier() {
    SupplierLedgerEntry manual =
        line(5L, LocalDate.of(2026, 9, 5), LedgerDirection.CREDIT, 10_000L, LedgerSource.MANUAL);
    when(ledgerRepository.findByFarmIdAndId(FARM, 5L)).thenReturn(Optional.of(manual));

    assertThatThrownBy(() -> service.deleteEntry(FARM, 99L, 5L))
        .isInstanceOf(NotFoundException.class);
    verify(ledgerRepository, never()).delete(any(SupplierLedgerEntry.class));
  }

  @Test
  void refusesToDeleteALineDerivedFromAPurchaseOrder() {
    SupplierLedgerEntry derived =
        line(
            6L,
            LocalDate.of(2026, 9, 5),
            LedgerDirection.DEBIT,
            400_000L,
            LedgerSource.PURCHASE_ORDER);
    when(ledgerRepository.findByFarmIdAndId(FARM, 6L)).thenReturn(Optional.of(derived));

    assertThatThrownBy(() -> service.deleteEntry(FARM, SUPPLIER, 6L))
        .isInstanceOf(BusinessRuleException.class);
    verify(ledgerRepository, never()).delete(any(SupplierLedgerEntry.class));
  }
}
