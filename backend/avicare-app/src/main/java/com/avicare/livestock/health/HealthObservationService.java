package com.avicare.livestock.health;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.HealthObservation;
import com.avicare.livestock.domain.LifecycleEvent;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Severity;
import com.avicare.livestock.repository.HealthObservationRepository;
import com.avicare.livestock.repository.LifecycleEventRepository;
import com.avicare.livestock.service.LivestockService;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Free-form health observations on a production unit (Sprint B3-2). Each {@link #record} journals a
 * {@code HEALTH_OBSERVATION} lifecycle event (no head-count change). Critical/warning observations
 * are queryable on their own for the future in-app alerts.
 */
@Service
@RequiredArgsConstructor
public class HealthObservationService {

  public static final String EVENT_HEALTH_OBSERVATION = "HEALTH_OBSERVATION";

  private static final List<Severity> CRITICAL_LEVELS =
      List.of(Severity.WARNING, Severity.CRITICAL);

  private final HealthObservationRepository observationRepository;
  private final LifecycleEventRepository lifecycleEventRepository;
  private final LivestockService livestockService;

  @Transactional
  public HealthObservation record(Long unitId, HealthObservationCommand cmd, Long userId) {
    ProductionUnit unit = livestockService.getUnit(unitId); // 404 if missing

    HealthObservation obs = new HealthObservation();
    obs.setProductionUnit(unit);
    obs.setObservationDate(cmd.observationDate());
    obs.setSeverity(cmd.severity() != null ? cmd.severity() : Severity.NORMAL);
    obs.setTitle(cmd.title());
    obs.setDescription(cmd.description());
    obs.setSuspectedDisease(cmd.suspectedDisease());
    obs.setObservedByUserId(cmd.observedByUserId());
    obs.setCreatedBy(userId);
    HealthObservation saved = observationRepository.save(obs);

    LifecycleEvent event = new LifecycleEvent();
    event.setProductionUnitId(unitId);
    event.setEventType(EVENT_HEALTH_OBSERVATION);
    event.setQuantityDelta(0);
    event.setReason("health_observation");
    event.setDetails(
        Map.of(
            "observation_date", cmd.observationDate().toString(),
            "severity", saved.getSeverity().name(),
            "title", cmd.title()));
    event.setCreatedBy(userId);
    lifecycleEventRepository.save(event);

    return saved;
  }

  @Transactional(readOnly = true)
  public List<HealthObservation> listForUnit(Long unitId) {
    return observationRepository.findByProductionUnitIdOrderByObservationDateDesc(unitId);
  }

  @Transactional(readOnly = true)
  public List<HealthObservation> listCriticalObservations(Long unitId) {
    return observationRepository.findByProductionUnitIdAndSeverityInOrderByObservationDateDesc(
        unitId, CRITICAL_LEVELS);
  }

  @Transactional(readOnly = true)
  public HealthObservation get(Long id) {
    return observationRepository
        .findById(id)
        .orElseThrow(() -> NotFoundException.of("HealthObservation", id));
  }

  @Transactional
  public void delete(Long id) {
    observationRepository.delete(get(id));
  }
}
