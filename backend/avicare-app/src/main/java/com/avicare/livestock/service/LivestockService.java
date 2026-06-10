package com.avicare.livestock.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transverse operations over the {@link ProductionUnit} hierarchy, usable without knowing the
 * species: read units, record generic lifecycle events, adjust the head count and close a unit.
 *
 * <p>Creating a unit is species-specific and lives in the species contexts (Sprint B1+), since
 * {@link ProductionUnit} is abstract here. Every count-changing operation is journaled as a {@link
 * LifecycleEvent} whose {@code quantityDelta} is applied to {@code currentCount} (never below 0).
 */
@Service
@RequiredArgsConstructor
public class LivestockService {

  public static final String EVENT_MORTALITY = "MORTALITY";
  public static final String EVENT_COUNT_ADJUSTMENT = "COUNT_ADJUSTMENT";
  public static final String EVENT_CREATED = "CREATED";

  private final ProductionUnitRepository productionUnitRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final BreedRepository breedRepository;

  @Transactional(readOnly = true)
  public ProductionUnit getUnit(Long unitId) {
    return productionUnitRepository
        .findById(unitId)
        .orElseThrow(() -> NotFoundException.of("ProductionUnit", unitId));
  }

  @Transactional(readOnly = true)
  public List<ProductionUnit> listByFarm(Long farmId) {
    return productionUnitRepository.findByFarmId(farmId);
  }

  /**
   * Create a generic production unit (e.g. a layer/ponte lot) on a farm: validates the breed exists
   * and is a POULTRY breed, seeds the count to {@code initialCount}, and journals a {@code CREATED}
   * lifecycle event. Species-specific subclasses (broilers) keep their own create paths.
   */
  @Transactional
  public ProductionUnit createUnit(
      Long farmId,
      Long breedId,
      UnitKind unitKind,
      String name,
      int initialCount,
      LocalDate startDate,
      String notes,
      Long userId) {
    Breed breed =
        breedRepository.findById(breedId).orElseThrow(() -> NotFoundException.of("Breed", breedId));
    if (breed.getSpecies() != Species.POULTRY) {
      throw new BusinessRuleException(
          "BREED_SPECIES_MISMATCH", "Breed " + breed.getCode() + " is not a POULTRY breed");
    }

    ProductionUnit unit = new ProductionUnit();
    unit.setFarmId(farmId);
    unit.setSpecies(Species.POULTRY);
    unit.setUnitKind(unitKind != null ? unitKind : UnitKind.BATCH);
    unit.setBreedId(breed.getId());
    unit.setName(name);
    unit.setStartDate(startDate != null ? startDate : LocalDate.now());
    unit.setCurrentCount(initialCount);
    unit.setStatus(UnitStatus.ACTIVE);
    unit.setCreatedBy(userId);
    ProductionUnit saved = productionUnitRepository.save(unit);

    Map<String, Object> details = new HashMap<>();
    details.put("initial_count", initialCount);
    details.put("breed_id", breed.getId());
    details.put("breed_code", breed.getCode());
    if (notes != null && !notes.isBlank()) {
      details.put("notes", notes);
    }

    LifecycleEvent created = new LifecycleEvent();
    created.setProductionUnitId(saved.getId());
    created.setEventType(EVENT_CREATED);
    created.setQuantityDelta(initialCount);
    created.setReason("unit_created");
    created.setDetails(details);
    created.setCreatedBy(userId);
    lifecycleEventRepository.save(created);

    return saved;
  }

  @Transactional(readOnly = true)
  public List<ProductionUnit> listByFarmAndStatus(Long farmId, UnitStatus status) {
    return productionUnitRepository.findByFarmIdAndStatus(farmId, status);
  }

  @Transactional(readOnly = true)
  public List<LifecycleEvent> listEvents(Long unitId) {
    return lifecycleEventRepository.findByProductionUnitId(unitId);
  }

  /**
   * Record a generic lifecycle event and apply its {@code quantityDelta} to the unit's count. A
   * delta that would drive the count below zero is rejected (422).
   */
  @Transactional
  public LifecycleEvent recordEvent(
      Long unitId,
      String eventType,
      int quantityDelta,
      String reason,
      Map<String, Object> details,
      Long userId) {
    ProductionUnit unit = getUnit(unitId);
    if (unit.getStatus() == UnitStatus.CLOSED || unit.getStatus() == UnitStatus.CANCELLED) {
      throw new BusinessRuleException(
          "PRODUCTION_UNIT_NOT_OPEN", "Cannot record an event on a " + unit.getStatus() + " unit");
    }
    int newCount = unit.getCurrentCount() + quantityDelta;
    if (newCount < 0) {
      throw new BusinessRuleException(
          "COUNT_BELOW_ZERO",
          "Delta "
              + quantityDelta
              + " would drive the count below 0 (current "
              + unit.getCurrentCount()
              + ")");
    }
    unit.setCurrentCount(newCount);

    LifecycleEvent event = new LifecycleEvent();
    event.setProductionUnitId(unitId);
    event.setEventType(eventType);
    event.setQuantityDelta(quantityDelta);
    event.setReason(reason);
    event.setDetails(details != null ? details : Map.of());
    event.setCreatedBy(userId);
    return lifecycleEventRepository.save(event);
  }

  /** Record mortality: a {@code MORTALITY} event decrementing the count by {@code count}. */
  @Transactional
  public LifecycleEvent recordMortality(Long unitId, int count, String reason, Long userId) {
    if (count <= 0) {
      throw new BusinessRuleException(
          "INVALID_MORTALITY_COUNT", "Mortality count must be positive");
    }
    return recordEvent(unitId, EVENT_MORTALITY, -count, reason, Map.of(), userId);
  }

  /** Set the unit's count to an exact value, journaling the delta as a COUNT_ADJUSTMENT. */
  @Transactional
  public LifecycleEvent adjustCount(Long unitId, int newCount, String reason, Long userId) {
    if (newCount < 0) {
      throw new BusinessRuleException("COUNT_BELOW_ZERO", "Count must be >= 0");
    }
    ProductionUnit unit = getUnit(unitId);
    int delta = newCount - unit.getCurrentCount();
    return recordEvent(unitId, EVENT_COUNT_ADJUSTMENT, delta, reason, Map.of(), userId);
  }

  /** Close a unit (end of production cycle): status CLOSED + end date today. */
  @Transactional
  public ProductionUnit closeUnit(Long unitId) {
    ProductionUnit unit = getUnit(unitId);
    if (unit.getStatus() == UnitStatus.CLOSED) {
      return unit;
    }
    unit.setStatus(UnitStatus.CLOSED);
    unit.setEndDate(LocalDate.now());
    return unit;
  }
}
