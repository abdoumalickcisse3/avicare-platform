package com.avicare.livestock.layer;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.EggCollection;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.repository.EggCollectionRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.service.LivestockService;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Egg collections on a layer production unit (Sprint B2-1). {@link #record} upserts one row per
 * (unit, date, timeslot) after validating the time-slot and grade keys against the farm's
 * parametrized config (3-layer resolve, with hard fallbacks so it never breaks unconfigured).
 *
 * <p>An {@code EGG_COLLECTION} lifecycle event (snapshot, no count change) is journaled — egg
 * production never alters the unit's head count (layer mortality stays on {@code daily_records}).
 */
@Service
@RequiredArgsConstructor
public class EggCollectionService {

  public static final String EVENT_EGG_COLLECTION = "EGG_COLLECTION";

  static final String CATEGORY_TIMESLOTS = "egg_timeslots";
  static final String CATEGORY_GRADES = "egg_grades";
  static final List<String> DEFAULT_TIMESLOTS = List.of("morning", "noon", "evening");
  static final List<String> DEFAULT_GRADES = List.of("S", "M", "L", "XL");

  private final EggCollectionRepository eggCollectionRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final LivestockService livestockService;
  private final ParametersFacade parametersFacade;

  @Transactional
  public EggCollection record(Long unitId, EggCollectionCommand cmd, Long userId) {
    ProductionUnit unit = livestockService.getUnit(unitId); // 404 if the unit does not exist
    validateTimeslot(unit.getFarmId(), cmd.timeslotKey());
    validateGrades(unit.getFarmId(), cmd.gradesCount());

    EggCollection rec =
        eggCollectionRepository
            .findByProductionUnitIdAndCollectionDateAndTimeslotKey(
                unitId, cmd.collectionDate(), cmd.timeslotKey())
            .orElseGet(EggCollection::new);

    rec.setProductionUnit(unit);
    rec.setCollectionDate(cmd.collectionDate());
    rec.setTimeslotKey(cmd.timeslotKey());
    rec.setTotalEggs(cmd.totalEggs());
    rec.setBrokenEggs(cmd.brokenEggs());
    rec.setGradesCount(cmd.gradesCount() != null ? cmd.gradesCount() : Map.of());
    rec.setCollectorUserId(cmd.collectorUserId());
    rec.setNotes(cmd.notes());
    if (rec.getCreatedBy() == null) {
      rec.setCreatedBy(userId);
    }
    EggCollection saved = eggCollectionRepository.save(rec);

    LifecycleEvent snapshot = new LifecycleEvent();
    snapshot.setProductionUnitId(unitId);
    snapshot.setEventType(EVENT_EGG_COLLECTION);
    snapshot.setQuantityDelta(0);
    snapshot.setReason("egg_collection");
    snapshot.setDetails(
        Map.of(
            "collection_date", cmd.collectionDate().toString(),
            "timeslot_key", cmd.timeslotKey(),
            "total_eggs", saved.getTotalEggs(),
            "broken_eggs", saved.getBrokenEggs()));
    snapshot.setCreatedBy(userId);
    lifecycleEventRepository.save(snapshot);

    return saved;
  }

  @Transactional(readOnly = true)
  public List<EggCollection> listForUnit(Long unitId) {
    return eggCollectionRepository.findByProductionUnitIdOrderByCollectionDateDescTimeslotKeyAsc(
        unitId);
  }

  @Transactional(readOnly = true)
  public List<EggCollection> listForUnitInPeriod(Long unitId, LocalDate from, LocalDate to) {
    return eggCollectionRepository.findByProductionUnitIdAndCollectionDateBetween(unitId, from, to);
  }

  private void validateTimeslot(Long farmId, String timeslotKey) {
    Set<String> configured = configuredKeys(farmId, CATEGORY_TIMESLOTS, DEFAULT_TIMESLOTS);
    if (!configured.contains(timeslotKey)) {
      throw new ValidationException(
          "UNKNOWN_TIMESLOT", "Time-slot '" + timeslotKey + "' is not configured for this farm");
    }
  }

  private void validateGrades(Long farmId, Map<String, Integer> gradesCount) {
    if (gradesCount == null || gradesCount.isEmpty()) {
      return;
    }
    Set<String> configured = configuredKeys(farmId, CATEGORY_GRADES, DEFAULT_GRADES);
    for (Map.Entry<String, Integer> entry : gradesCount.entrySet()) {
      if (!configured.contains(entry.getKey())) {
        throw new ValidationException(
            "UNKNOWN_EGG_GRADE", "Egg grade '" + entry.getKey() + "' is not configured");
      }
      if (entry.getValue() == null || entry.getValue() < 0) {
        throw new ValidationException(
            "INVALID_GRADE_COUNT", "Grade '" + entry.getKey() + "' count must be >= 0");
      }
    }
  }

  /** Configured keys of a parametrized category for the farm, falling back to the defaults. */
  private Set<String> configuredKeys(Long farmId, String category, List<String> fallback) {
    List<String> keys =
        parametersFacade.listForFarm(farmId, category).stream()
            .map(CatalogEntryInfo::key)
            .collect(Collectors.toList());
    return keys.isEmpty() ? Set.copyOf(fallback) : Set.copyOf(keys);
  }
}
