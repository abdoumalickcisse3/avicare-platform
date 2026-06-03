package com.avicare.livestock.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for {@link LivestockService} count adjustments and lifecycle rules (repos mocked). */
class LivestockServiceTest {

  private ProductionUnitRepository productionUnitRepository;
  private LifecycleEventRepository lifecycleEventRepository;
  private LivestockService service;

  @BeforeEach
  void setUp() {
    productionUnitRepository = Mockito.mock(ProductionUnitRepository.class);
    lifecycleEventRepository = Mockito.mock(LifecycleEventRepository.class);
    service = new LivestockService(productionUnitRepository, lifecycleEventRepository);
    lenient()
        .when(lifecycleEventRepository.save(any(LifecycleEvent.class)))
        .thenAnswer(i -> i.getArgument(0));
  }

  private ProductionUnit unit(int count, UnitStatus status) {
    ProductionUnit u = new ProductionUnit();
    u.setId(1L);
    u.setFarmId(7L);
    u.setSpecies(Species.POULTRY);
    u.setUnitKind(UnitKind.BATCH);
    u.setCurrentCount(count);
    u.setStatus(status);
    return u;
  }

  @Test
  void recordMortality_decrementsCountAndJournalsEvent() {
    ProductionUnit u = unit(500, UnitStatus.ACTIVE);
    when(productionUnitRepository.findById(1L)).thenReturn(Optional.of(u));

    LifecycleEvent event = service.recordMortality(1L, 12, "heat", 99L);

    assertThat(u.getCurrentCount()).isEqualTo(488);
    assertThat(event.getEventType()).isEqualTo(LivestockService.EVENT_MORTALITY);
    assertThat(event.getQuantityDelta()).isEqualTo(-12);
  }

  @Test
  void recordMortality_nonPositive_throws422() {
    assertThatThrownBy(() -> service.recordMortality(1L, 0, null, 99L))
        .isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void recordEvent_belowZero_throws422() {
    when(productionUnitRepository.findById(1L)).thenReturn(Optional.of(unit(5, UnitStatus.ACTIVE)));

    assertThatThrownBy(() -> service.recordEvent(1L, "X", -6, null, null, 99L))
        .isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void recordEvent_onClosedUnit_throws422() {
    when(productionUnitRepository.findById(1L)).thenReturn(Optional.of(unit(5, UnitStatus.CLOSED)));

    assertThatThrownBy(() -> service.recordEvent(1L, "X", -1, null, null, 99L))
        .isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void adjustCount_setsExactValue_viaDelta() {
    ProductionUnit u = unit(500, UnitStatus.ACTIVE);
    when(productionUnitRepository.findById(1L)).thenReturn(Optional.of(u));

    LifecycleEvent event = service.adjustCount(1L, 480, "recount", 99L);

    assertThat(u.getCurrentCount()).isEqualTo(480);
    assertThat(event.getQuantityDelta()).isEqualTo(-20);
    assertThat(event.getEventType()).isEqualTo(LivestockService.EVENT_COUNT_ADJUSTMENT);
  }

  @Test
  void closeUnit_setsClosedAndEndDate() {
    ProductionUnit u = unit(0, UnitStatus.ACTIVE);
    when(productionUnitRepository.findById(1L)).thenReturn(Optional.of(u));

    service.closeUnit(1L);

    assertThat(u.getStatus()).isEqualTo(UnitStatus.CLOSED);
    assertThat(u.getEndDate()).isNotNull();
  }

  @Test
  void getUnit_unknown_throwsNotFound() {
    when(productionUnitRepository.findById(99L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.getUnit(99L)).isInstanceOf(NotFoundException.class);
  }
}
