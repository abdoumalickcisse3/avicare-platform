package com.avicare.livestock.health;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.finance.api.FinanceFacade;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.VetVisit;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.VetVisitRepository;
import com.avicare.livestock.repository.VeterinarianRepository;
import com.avicare.livestock.service.LivestockService;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for the finance auto-expense wiring on {@link VetVisitService}. */
class VetVisitServiceTest {

  private VetVisitRepository vetVisitRepository;
  private LifecycleEventRepository lifecycleEventRepository;
  private LivestockService livestockService;
  private VeterinarianRepository veterinarianRepository;
  private FinanceFacade financeFacade;
  private VetVisitService service;

  @BeforeEach
  void setUp() {
    vetVisitRepository = Mockito.mock(VetVisitRepository.class);
    lifecycleEventRepository = Mockito.mock(LifecycleEventRepository.class);
    livestockService = Mockito.mock(LivestockService.class);
    veterinarianRepository = Mockito.mock(VeterinarianRepository.class);
    financeFacade = Mockito.mock(FinanceFacade.class);
    service =
        new VetVisitService(
            vetVisitRepository,
            lifecycleEventRepository,
            livestockService,
            veterinarianRepository,
            financeFacade);
  }

  private ProductionUnit unitWithFarm(long farmId) {
    ProductionUnit u = Mockito.mock(ProductionUnit.class);
    when(u.getFarmId()).thenReturn(farmId);
    return u;
  }

  private VetVisit savedVisitWithId(long id) {
    VetVisit v = Mockito.mock(VetVisit.class);
    when(v.getId()).thenReturn(id);
    return v;
  }

  @Test
  void record_withPositiveCost_createsVetVisitExpense() {
    ProductionUnit unit = unitWithFarm(3L);
    when(livestockService.getUnit(5L)).thenReturn(unit);
    VetVisit saved = savedVisitWithId(77L);
    when(vetVisitRepository.save(any(VetVisit.class))).thenReturn(saved);

    service.record(
        5L,
        new VetVisitCommand(
            null, LocalDate.of(2026, 7, 6), "Vaccination", null, null, 15000, false, null, null),
        9L);

    verify(financeFacade)
        .recordVetVisitExpense(
            eq(3L),
            eq(77L),
            eq("Visite vétérinaire — Vaccination"),
            eq(15000L),
            eq(LocalDate.of(2026, 7, 6)),
            eq(5L),
            eq(9L));
  }

  @Test
  void record_withoutCost_doesNotCreateExpense() {
    ProductionUnit unit = unitWithFarm(3L);
    when(livestockService.getUnit(5L)).thenReturn(unit);
    VetVisit saved = savedVisitWithId(77L);
    when(vetVisitRepository.save(any(VetVisit.class))).thenReturn(saved);

    service.record(
        5L,
        new VetVisitCommand(
            null, LocalDate.of(2026, 7, 6), "Contrôle", null, null, null, false, null, null),
        9L);

    verify(financeFacade, never())
        .recordVetVisitExpense(anyLong(), anyLong(), any(), anyLong(), any(), any(), any());
  }

  @Test
  void delete_reversesVetVisitExpense() {
    ProductionUnit unit = unitWithFarm(3L);
    VetVisit v = Mockito.mock(VetVisit.class);
    when(v.getProductionUnit()).thenReturn(unit);
    when(vetVisitRepository.findById(88L)).thenReturn(Optional.of(v));

    service.delete(88L);

    verify(financeFacade).reverseVetVisitExpense(3L, 88L);
    verify(vetVisitRepository).delete(v);
  }
}
