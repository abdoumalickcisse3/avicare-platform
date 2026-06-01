package com.avicare.parameters.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.parameters.domain.AlertSeverity;
import com.avicare.parameters.domain.AlertThreshold;
import com.avicare.parameters.repository.AlertThresholdRepository;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages a farm's alert thresholds. One threshold per (farm, type): {@link #upsert} creates or
 * updates the row in place.
 */
@Service
@RequiredArgsConstructor
public class ThresholdService {

  private final AlertThresholdRepository alertThresholdRepository;

  @Transactional
  public AlertThreshold upsert(Long farmId, String type, BigDecimal value, AlertSeverity severity) {
    AlertThreshold threshold =
        alertThresholdRepository
            .findByFarmIdAndThresholdType(farmId, type)
            .orElseGet(AlertThreshold::new);
    threshold.setFarmId(farmId);
    threshold.setThresholdType(type);
    threshold.setThresholdValue(value);
    threshold.setSeverity(severity);
    return alertThresholdRepository.save(threshold);
  }

  @Transactional(readOnly = true)
  public List<AlertThreshold> list(Long farmId) {
    return alertThresholdRepository.findByFarmId(farmId);
  }

  @Transactional(readOnly = true)
  public AlertThreshold get(Long farmId, String type) {
    return alertThresholdRepository
        .findByFarmIdAndThresholdType(farmId, type)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "ALERT_THRESHOLD_NOT_FOUND", "No threshold " + type + " for farm " + farmId));
  }

  @Transactional
  public void delete(Long farmId, String type) {
    alertThresholdRepository.delete(get(farmId, type));
  }
}
