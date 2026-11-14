package com.avicare.survey.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.avicare.survey.domain.FlockType;
import com.avicare.survey.domain.SurveyResponse;
import com.avicare.survey.dto.SurveySubmission;
import com.avicare.survey.repository.SurveyResponseRepository;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * The submission endpoint is open to the world, so what it refuses and what it keeps are security
 * decisions, not conveniences.
 */
@ExtendWith(MockitoExtension.class)
class SurveyServiceTest {

  @Mock private SurveyResponseRepository repository;

  @InjectMocks private SurveyService service;

  private static SurveySubmission submission(String website) {
    return new SurveySubmission(
        new SurveySubmission.Where("sn", "  Thiès  ", "Pout", "groupe WhatsApp Thiès"),
        new SurveySubmission.Flock(FlockType.BROILER, 450, 4, 2021, 2),
        null,
        null,
        null,
        null,
        null,
        null,
        website);
  }

  private List<SurveyResponse> captureSaved(int times) {
    ArgumentCaptor<SurveyResponse> saved = ArgumentCaptor.forClass(SurveyResponse.class);
    verify(repository, org.mockito.Mockito.times(times)).save(saved.capture());
    return saved.getAllValues();
  }

  @Test
  @DisplayName("the caller's address is kept only as a hash, never in clear")
  void addressIsHashedNeverStored() {
    service.record(submission(null), "41.82.100.7");

    SurveyResponse stored = captureSaved(1).getFirst();
    assertThat(stored.getIpHash()).isNotNull().doesNotContain("41.82.100.7").hasSize(64);
  }

  @Test
  @DisplayName("the same address always hashes the same way, a different one never does")
  void hashingIsStableAndDiscriminating() {
    service.record(submission(null), "41.82.100.7");
    service.record(submission(null), "41.82.100.7");
    service.record(submission(null), "41.82.100.8");

    List<SurveyResponse> stored = captureSaved(3);
    assertThat(stored.get(0).getIpHash()).isEqualTo(stored.get(1).getIpHash());
    assertThat(stored.get(2).getIpHash()).isNotEqualTo(stored.get(0).getIpHash());
  }

  @Test
  @DisplayName("country is upper-cased and region trimmed, whatever the page sent")
  void placeIsNormalised() {
    service.record(submission(null), "41.82.100.7");

    SurveyResponse stored = captureSaved(1).getFirst();
    assertThat(stored.getCountry()).isEqualTo("SN");
    assertThat(stored.getRegion()).isEqualTo("Thiès");
  }

  @Test
  @DisplayName("a filled honeypot saves nothing, and tells the sender nothing about it")
  void honeypotSavesNothing() {
    service.record(submission("http://buy-cheap.example"), "41.82.100.7");

    verify(repository, never()).save(any());
  }

  @Test
  @DisplayName("an address that already left its daily quota is refused, loudly")
  void oneAddressCannotStuffTheBallot() {
    org.mockito.Mockito.when(
            repository.countByIpHashAndCreatedAtAfter(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any(java.time.LocalDateTime.class)))
        .thenReturn((long) SurveyService.MAX_PER_ADDRESS_PER_DAY);

    org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> service.record(submission(null), "41.82.100.7"))
        .isInstanceOf(com.avicare.common.api.exception.BusinessRuleException.class);

    verify(repository, never()).save(any());
  }

  /**
   * The results endpoint answers without a token, so the work it costs is whatever a stranger
   * decides to ask for. Reading the table on every call would hand that lever away; the figures are
   * recomputed on a timer instead, and only the first caller in the window pays for it.
   */
  @Test
  @DisplayName("repeated reads of the results cost one table read, not one each")
  void resultsAreRecomputedOnATimerNotPerCall() {
    org.mockito.Mockito.when(repository.findAll()).thenReturn(java.util.List.of());

    for (int i = 0; i < 25; i++) {
      service.results();
    }

    verify(repository, org.mockito.Mockito.times(1)).findAll();
  }

  @Test
  @DisplayName("a fresh answer is not kept out of the figures by the cache")
  void recordingAnAnswerInvalidatesTheCache() {
    org.mockito.Mockito.when(repository.findAll()).thenReturn(java.util.List.of());

    service.results();
    service.record(submission(null), "41.82.100.7");
    service.results();

    verify(repository, org.mockito.Mockito.times(2)).findAll();
  }

  @Test
  @DisplayName("a robot stopped by the honeypot never even costs a count query")
  void honeypotShortCircuitsBeforeCounting() {
    service.record(submission("http://buy-cheap.example"), "41.82.100.7");

    verify(repository, never())
        .countByIpHashAndCreatedAtAfter(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any(java.time.LocalDateTime.class));
  }
}
