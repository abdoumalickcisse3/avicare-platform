package com.avicare.livestock.poultry;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.domain.UnitKind;
import com.avicare.livestock.domain.UnitStatus;
import com.avicare.livestock.repository.BreedRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.repository.PoultryBatchRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Broiler batch CRUD (Sprint B1-1). Creating a batch materialises a {@link PoultryBatch} (parent
 * {@code production_units} row + child {@code poultry_batches} row, JPA JOINED) with its count
 * seeded to {@code initialCount}, and journals a {@code CREATED} lifecycle event. REST endpoints
 * and the {@code @farmAccess} guard land in B1-3.
 */
@Service
@RequiredArgsConstructor
public class PoultryBatchService {

  public static final String EVENT_CREATED = "CREATED";

  private final PoultryBatchRepository poultryBatchRepository;
  private final BreedRepository breedRepository;
  private final LifecycleEventRepository lifecycleEventRepository;

  @Transactional
  public PoultryBatch create(PoultryBatchCreate cmd, Long currentUserId) {
    Breed breed =
        breedRepository
            .findById(cmd.breedId())
            .orElseThrow(() -> NotFoundException.of("Breed", cmd.breedId()));
    if (breed.getSpecies() != Species.POULTRY) {
      throw new BusinessRuleException(
          "BREED_SPECIES_MISMATCH", "Breed " + breed.getCode() + " is not a POULTRY breed");
    }

    PoultryBatch batch = new PoultryBatch();
    batch.setFarmId(cmd.farmId());
    batch.setSpecies(Species.POULTRY);
    batch.setUnitKind(UnitKind.BATCH);
    batch.setBreedId(breed.getId()); // parent column — keeps ProductionUnitResponse consistent
    batch.setBreed(breed); // child NOT NULL column + navigation for B1-2 growth curves
    batch.setName(cmd.name());
    batch.setStartDate(cmd.startDate() != null ? cmd.startDate() : LocalDate.now());
    batch.setCurrentCount(cmd.initialCount());
    batch.setStatus(UnitStatus.ACTIVE);
    batch.setCreatedBy(currentUserId);
    batch.setTargetWeightG(cmd.targetWeightG());
    batch.setTargetAgeDays(cmd.targetAgeDays());
    batch.setInitialCount(cmd.initialCount());
    PoultryBatch saved = poultryBatchRepository.save(batch);

    LifecycleEvent created = new LifecycleEvent();
    created.setProductionUnitId(saved.getId());
    created.setEventType(EVENT_CREATED);
    created.setQuantityDelta(cmd.initialCount());
    created.setReason("batch_created");
    created.setDetails(
        Map.of(
            "initial_count", cmd.initialCount(),
            "breed_id", breed.getId(),
            "breed_code", breed.getCode()));
    created.setCreatedBy(currentUserId);
    lifecycleEventRepository.save(created);

    return saved;
  }

  @Transactional(readOnly = true)
  public List<PoultryBatch> list(Long farmId, UnitStatus status) {
    return status != null
        ? poultryBatchRepository.findByFarmIdAndStatus(farmId, status)
        : poultryBatchRepository.findByFarmId(farmId);
  }

  @Transactional(readOnly = true)
  public PoultryBatch get(Long id) {
    return poultryBatchRepository
        .findById(id)
        .orElseThrow(() -> NotFoundException.of("PoultryBatch", id));
  }
}
