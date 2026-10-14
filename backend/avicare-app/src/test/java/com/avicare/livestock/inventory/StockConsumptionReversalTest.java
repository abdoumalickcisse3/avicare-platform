package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.repository.StockMovementRepository;
import com.avicare.subscription.api.SubscriptionFacade;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Undoing the stock consumptions of a source action ({@link
 * StockConsumptionService#reverseConsumptions}).
 *
 * <p>Two real incidents motivate it. A daily record is an upsert: re-saving it used to apply its
 * consumption a second time, so a farm that corrected "1 bag" into "2 bags" had 3 taken out of
 * stock. And deleting a treatment used to cascade-delete its movement row while leaving the
 * quantity down — a negative stock with an empty journal.
 *
 * <p>The journal is append-only: a reversal is a compensating {@code IN}, never a deletion, and it
 * keeps the source backref so a second correction nets against it instead of double-crediting.
 */
@ExtendWith(MockitoExtension.class)
class StockConsumptionReversalTest {

  @Mock StockItemService stockItemService;
  @Mock StockMovementService stockMovementService;
  @Mock SubscriptionFacade subscriptionFacade;
  @Mock StockMovementRepository stockMovementRepository;

  static final Long FARM = 1L;
  static final Long USER = 42L;
  static final Long UNIT = 9L;
  static final Long RECORD = 42L;
  static final LocalDate DAY = LocalDate.of(2026, 10, 13);

  private StockConsumptionService service() {
    return new StockConsumptionService(
        stockItemService, stockMovementService, subscriptionFacade, stockMovementRepository);
  }

  private static StockItem item(long id) {
    StockItem i = new StockItem();
    i.setId(id);
    i.setFarmId(FARM);
    return i;
  }

  private static StockMovement movement(StockItem item, MovementType type, String qty) {
    StockMovement m = new StockMovement();
    m.setStockItem(item);
    m.setMovementType(type);
    m.setQuantity(new BigDecimal(qty));
    m.setMovementDate(DAY);
    m.setDailyRecordId(RECORD);
    m.setProductionUnitId(UNIT);
    return m;
  }

  @Test
  void compensatesWhatTheSourceActionTookOut() {
    StockItem charcoal = item(6L);
    when(stockMovementRepository.findByDailyRecordId(RECORD))
        .thenReturn(List.of(movement(charcoal, MovementType.OUT, "1")));

    service().reverseConsumptions(FARM, ConsumptionSource.dailyRecord(UNIT, RECORD), USER);

    ArgumentCaptor<StockMovementCommand> cmd = ArgumentCaptor.forClass(StockMovementCommand.class);
    verify(stockMovementService).recordMovement(any(), cmd.capture(), any());
    assertThat(cmd.getValue().stockItemId()).isEqualTo(6L);
    assertThat(cmd.getValue().movementType()).isEqualTo(MovementType.IN);
    assertThat(cmd.getValue().quantity()).isEqualByComparingTo("1");
    assertThat(cmd.getValue().reason()).isEqualTo(MovementReason.ERROR_CORRECTION);
  }

  @Test
  void keepsTheSourceBackrefSoASecondCorrectionCanNetAgainstIt() {
    StockItem charcoal = item(6L);
    when(stockMovementRepository.findByDailyRecordId(RECORD))
        .thenReturn(List.of(movement(charcoal, MovementType.OUT, "1")));

    service().reverseConsumptions(FARM, ConsumptionSource.dailyRecord(UNIT, RECORD), USER);

    ArgumentCaptor<StockMovementCommand> cmd = ArgumentCaptor.forClass(StockMovementCommand.class);
    verify(stockMovementService).recordMovement(any(), cmd.capture(), any());
    assertThat(cmd.getValue().dailyRecordId()).isEqualTo(RECORD);
    assertThat(cmd.getValue().productionUnitId()).isEqualTo(UNIT);
    assertThat(cmd.getValue().movementDate()).isEqualTo(DAY);
  }

  @Test
  void writesNothingWhenTheConsumptionWasAlreadyReversed() {
    StockItem charcoal = item(6L);
    when(stockMovementRepository.findByDailyRecordId(RECORD))
        .thenReturn(
            List.of(
                movement(charcoal, MovementType.OUT, "1"),
                movement(charcoal, MovementType.IN, "1")));

    service().reverseConsumptions(FARM, ConsumptionSource.dailyRecord(UNIT, RECORD), USER);

    verify(stockMovementService, never()).recordMovement(anyLong(), any(), anyLong());
  }

  @Test
  void writesNothingWhenTheSourceActionNeverTouchedStock() {
    when(stockMovementRepository.findByDailyRecordId(RECORD)).thenReturn(List.of());

    service().reverseConsumptions(FARM, ConsumptionSource.dailyRecord(UNIT, RECORD), USER);

    verify(stockMovementService, never()).recordMovement(anyLong(), any(), anyLong());
  }

  @Test
  void compensatesEachArticleOfADecomposedFormulaSeparately() {
    StockItem corn = item(31L);
    StockItem concentrate = item(30L);
    when(stockMovementRepository.findByDailyRecordId(RECORD))
        .thenReturn(
            List.of(
                movement(corn, MovementType.OUT, "70"),
                movement(concentrate, MovementType.OUT, "30")));

    service().reverseConsumptions(FARM, ConsumptionSource.dailyRecord(UNIT, RECORD), USER);

    ArgumentCaptor<StockMovementCommand> cmd = ArgumentCaptor.forClass(StockMovementCommand.class);
    verify(stockMovementService, org.mockito.Mockito.times(2))
        .recordMovement(any(), cmd.capture(), any());
    assertThat(cmd.getAllValues())
        .extracting(StockMovementCommand::stockItemId, c -> c.quantity().intValueExact())
        .containsExactlyInAnyOrder(
            org.assertj.core.groups.Tuple.tuple(31L, 70),
            org.assertj.core.groups.Tuple.tuple(30L, 30));
  }

  @Test
  void compensatesOnlyTheRemainderWhenACorrectionIsPartiallyReversed() {
    StockItem charcoal = item(6L);
    when(stockMovementRepository.findByDailyRecordId(RECORD))
        .thenReturn(
            List.of(
                movement(charcoal, MovementType.OUT, "1"),
                movement(charcoal, MovementType.IN, "1"),
                movement(charcoal, MovementType.OUT, "2")));

    service().reverseConsumptions(FARM, ConsumptionSource.dailyRecord(UNIT, RECORD), USER);

    ArgumentCaptor<StockMovementCommand> cmd = ArgumentCaptor.forClass(StockMovementCommand.class);
    verify(stockMovementService).recordMovement(any(), cmd.capture(), any());
    assertThat(cmd.getValue().quantity()).isEqualByComparingTo("2");
  }

  @Test
  void reversesByVaccinationBackrefWhenThatIsTheSource() {
    StockItem vaccine = item(24L);
    StockMovement m = movement(vaccine, MovementType.OUT, "0.5");
    m.setDailyRecordId(null);
    m.setVaccinationId(7L);
    when(stockMovementRepository.findByVaccinationId(7L)).thenReturn(List.of(m));

    service().reverseConsumptions(FARM, ConsumptionSource.vaccination(UNIT, 7L), USER);

    ArgumentCaptor<StockMovementCommand> cmd = ArgumentCaptor.forClass(StockMovementCommand.class);
    verify(stockMovementService).recordMovement(any(), cmd.capture(), any());
    assertThat(cmd.getValue().vaccinationId()).isEqualTo(7L);
    assertThat(cmd.getValue().quantity()).isEqualByComparingTo("0.5");
  }

  @Test
  void reversesByTreatmentBackrefWhenThatIsTheSource() {
    StockItem medication = item(25L);
    StockMovement m = movement(medication, MovementType.OUT, "0.030");
    m.setDailyRecordId(null);
    m.setTreatmentExecutedId(3L);
    when(stockMovementRepository.findByTreatmentExecutedId(3L)).thenReturn(List.of(m));

    service().reverseConsumptions(FARM, ConsumptionSource.treatment(UNIT, 3L), USER);

    ArgumentCaptor<StockMovementCommand> cmd = ArgumentCaptor.forClass(StockMovementCommand.class);
    verify(stockMovementService).recordMovement(any(), cmd.capture(), any());
    assertThat(cmd.getValue().treatmentExecutedId()).isEqualTo(3L);
    assertThat(cmd.getValue().quantity()).isEqualByComparingTo("0.030");
  }
}
