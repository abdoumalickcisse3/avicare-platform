package com.avicare.livestock.health;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.TreatmentExecuted;
import com.avicare.livestock.domain.Veterinarian;
import com.avicare.livestock.inventory.ConsumptionSource;
import com.avicare.livestock.inventory.StockConsumptionService;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.TreatmentExecutedRepository;
import com.avicare.livestock.repository.VeterinarianRepository;
import com.avicare.livestock.service.LivestockService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Unit test for {@link TreatmentExecutedService#record} — the withdrawal SNAPSHOT + date
 * computation and the cross-farm vet guard (collaborators mocked). Runs in surefire/CI.
 */
class TreatmentExecutedServiceTest {

  private TreatmentExecutedRepository treatmentRepository;
  private LivestockService livestockService;
  private HealthCatalogService healthCatalogService;
  private VeterinarianRepository veterinarianRepository;
  private StockConsumptionService stockConsumptionService;
  private TreatmentExecutedService service;

  @BeforeEach
  void setUp() {
    treatmentRepository = Mockito.mock(TreatmentExecutedRepository.class);
    livestockService = Mockito.mock(LivestockService.class);
    healthCatalogService = Mockito.mock(HealthCatalogService.class);
    veterinarianRepository = Mockito.mock(VeterinarianRepository.class);
    stockConsumptionService = Mockito.mock(StockConsumptionService.class);
    service =
        new TreatmentExecutedService(
            treatmentRepository,
            Mockito.mock(LifecycleEventRepository.class),
            livestockService,
            healthCatalogService,
            veterinarianRepository,
            stockConsumptionService);
    when(treatmentRepository.save(any(TreatmentExecuted.class))).thenAnswer(i -> i.getArgument(0));
  }

  private ProductionUnit unit(long farmId) {
    ProductionUnit u = new ProductionUnit();
    u.setFarmId(farmId);
    u.setCurrentCount(1000);
    return u;
  }

  private void catalogHasAmoxicillin() {
    when(healthCatalogService.listTreatments(anyLong()))
        .thenReturn(
            List.of(
                new TreatmentDto(
                    "amoxicillin_50",
                    "Amox",
                    "Amoxicilline",
                    "ANTIBIOTIC",
                    7,
                    9,
                    List.of("WATER"),
                    "V1",
                    false)));
  }

  private TreatmentCommand cmd(String key, Long vetId) {
    return new TreatmentCommand(
        key,
        LocalDate.of(2026, 6, 1),
        5,
        BigDecimal.ONE,
        "mg/L",
        "WATER",
        1000,
        "Forte mortalité",
        "FARMER",
        vetId,
        null,
        null,
        null);
  }

  @Test
  void snapshotsWithdrawalAndComputesDates() {
    when(livestockService.getUnit(9L)).thenReturn(unit(5));
    catalogHasAmoxicillin();

    TreatmentExecuted t = service.record(9L, cmd("amoxicillin_50", null), 1L);

    assertThat(t.getEndDate()).isEqualTo(LocalDate.of(2026, 6, 5)); // start + duration - 1
    assertThat(t.getWithdrawalDaysMeat()).isEqualTo(7);
    assertThat(t.getWithdrawalDaysEggs()).isEqualTo(9);
    assertThat(t.getWithdrawalEndDateMeat()).isEqualTo(LocalDate.of(2026, 6, 12)); // end + 7
    assertThat(t.getWithdrawalEndDateEggs()).isEqualTo(LocalDate.of(2026, 6, 14)); // end + 9
  }

  @Test
  void unknownTreatment_throws() {
    when(livestockService.getUnit(9L)).thenReturn(unit(5));
    when(healthCatalogService.listTreatments(anyLong())).thenReturn(List.of());
    assertThatThrownBy(() -> service.record(9L, cmd("nope", null), 1L))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void vetFromAnotherFarm_throws() {
    when(livestockService.getUnit(9L)).thenReturn(unit(5));
    catalogHasAmoxicillin();
    Veterinarian vet = new Veterinarian();
    vet.setFarmId(99L); // different farm than the unit (5)
    when(veterinarianRepository.findById(3L)).thenReturn(Optional.of(vet));

    assertThatThrownBy(() -> service.record(9L, cmd("amoxicillin_50", 3L), 1L))
        .isInstanceOf(ValidationException.class);
  }

  /**
   * Deleting a treatment used to cascade-delete its stock movement while leaving the quantity down:
   * a medication stuck at a negative with an empty journal, impossible to explain to the farmer.
   * The medication it consumed has to be given back first.
   */
  @Test
  void deletingATreatmentGivesBackTheMedicationItConsumed() {
    TreatmentExecuted t = new TreatmentExecuted();
    t.setId(3L);
    t.setProductionUnit(unit(7L));
    when(treatmentRepository.findById(3L)).thenReturn(Optional.of(t));

    service.delete(3L, 42L);

    org.mockito.ArgumentCaptor<ConsumptionSource> src =
        org.mockito.ArgumentCaptor.forClass(ConsumptionSource.class);
    Mockito.verify(stockConsumptionService)
        .reverseConsumptions(Mockito.eq(7L), src.capture(), Mockito.eq(42L));
    assertThat(src.getValue().treatmentExecutedId()).isEqualTo(3L);
  }

  @Test
  void deletingATreatmentGivesTheStockBackBeforeTheRowIsGone() {
    TreatmentExecuted t = new TreatmentExecuted();
    t.setId(3L);
    t.setProductionUnit(unit(7L));
    when(treatmentRepository.findById(3L)).thenReturn(Optional.of(t));

    service.delete(3L, 42L);

    org.mockito.InOrder order = Mockito.inOrder(stockConsumptionService, treatmentRepository);
    order.verify(stockConsumptionService).reverseConsumptions(anyLong(), any(), anyLong());
    order.verify(treatmentRepository).delete(t);
  }
}
