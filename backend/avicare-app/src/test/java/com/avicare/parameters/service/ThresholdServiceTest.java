package com.avicare.parameters.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.parameters.domain.AlertSeverity;
import com.avicare.parameters.domain.AlertThreshold;
import com.avicare.parameters.repository.AlertThresholdRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for {@link ThresholdService} (repository mocked). */
class ThresholdServiceTest {

  private AlertThresholdRepository repository;
  private ThresholdService service;

  @BeforeEach
  void setUp() {
    repository = Mockito.mock(AlertThresholdRepository.class);
    service = new ThresholdService(repository);
  }

  @Test
  void upsert_updatesExistingByType() {
    AlertThreshold existing = new AlertThreshold();
    existing.setFarmId(7L);
    existing.setThresholdType("mortality_rate");
    existing.setSeverity(AlertSeverity.WARNING);
    when(repository.findByFarmIdAndThresholdType(7L, "mortality_rate"))
        .thenReturn(Optional.of(existing));
    when(repository.save(any(AlertThreshold.class))).thenAnswer(i -> i.getArgument(0));

    AlertThreshold saved =
        service.upsert(7L, "mortality_rate", new BigDecimal("5.5"), AlertSeverity.CRITICAL);

    assertThat(saved.getSeverity()).isEqualTo(AlertSeverity.CRITICAL);
    assertThat(saved.getThresholdValue()).isEqualByComparingTo("5.5");
  }

  @Test
  void upsert_createsWhenAbsent() {
    when(repository.findByFarmIdAndThresholdType(7L, "feed_stock")).thenReturn(Optional.empty());
    when(repository.save(any(AlertThreshold.class))).thenAnswer(i -> i.getArgument(0));

    AlertThreshold saved =
        service.upsert(7L, "feed_stock", new BigDecimal("100"), AlertSeverity.INFO);

    assertThat(saved.getThresholdType()).isEqualTo("feed_stock");
    assertThat(saved.getFarmId()).isEqualTo(7L);
  }

  @Test
  void get_unknown_throwsNotFound() {
    when(repository.findByFarmIdAndThresholdType(7L, "ghost")).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.get(7L, "ghost")).isInstanceOf(NotFoundException.class);
  }
}
