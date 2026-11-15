package com.avicare.survey.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.survey.domain.FlockType;
import com.avicare.survey.domain.SurveyResponse;
import com.avicare.survey.dto.SurveyAnswerRow;
import com.avicare.survey.dto.SurveyIntake;
import com.avicare.survey.repository.SurveyResponseRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

/**
 * The reading side of the survey. What matters here is that a filter narrows and never widens, and
 * that "accepts an interview" means somebody who can actually be called back.
 */
@ExtendWith(MockitoExtension.class)
class SurveyAdminServiceTest {

  @Mock private SurveyResponseRepository repository;

  @InjectMocks private SurveyAdminService service;

  private static SurveyResponse answer(
      long id, String country, String region, FlockType type, String phone, Boolean interview) {
    SurveyResponse a = new SurveyResponse();
    a.setId(id);
    a.setCountry(country);
    a.setRegion(region);
    a.setFlockType(type);
    a.setCurrentBirds(300);
    a.setPhone(phone);
    a.setAcceptsInterview(interview);
    a.setCreatedAt(LocalDateTime.of(2026, 11, 15, 9, 0).plusMinutes(id));
    return a;
  }

  private void stored(SurveyResponse... answers) {
    when(repository.findAll()).thenReturn(List.of(answers));
  }

  private List<Long> ids(Page<SurveyAnswerRow> page) {
    return page.getContent().stream().map(SurveyAnswerRow::id).toList();
  }

  @Test
  @DisplayName("newest first, by id — two answers in the same second keep a stable order")
  void newestFirst() {
    stored(
        answer(1, "SN", "Thiès", FlockType.BROILER, null, null),
        answer(3, "SN", "Dakar", FlockType.LAYER, null, null),
        answer(2, "CI", "Abidjan", FlockType.BOTH, null, null));

    assertThat(ids(service.search(null, null, null, false, PageRequest.of(0, 10))))
        .containsExactly(3L, 2L, 1L);
  }

  @Test
  @DisplayName("the country filter ignores case, because the form sends what the browser sends")
  void countryFilterIgnoresCase() {
    stored(
        answer(1, "SN", "Thiès", FlockType.BROILER, null, null),
        answer(2, "CI", "Abidjan", FlockType.BROILER, null, null));

    assertThat(ids(service.search("ci", null, null, false, PageRequest.of(0, 10))))
        .containsExactly(2L);
  }

  @Test
  @DisplayName("the region is matched as a fragment: « abid » finds Abidjan")
  void regionIsAFragment() {
    stored(
        answer(1, "SN", "Thiès", FlockType.BROILER, null, null),
        answer(2, "CI", "Abidjan", FlockType.BROILER, null, null));

    assertThat(ids(service.search(null, "abid", null, false, PageRequest.of(0, 10))))
        .containsExactly(2L);
  }

  @Test
  @DisplayName("the flock filter is exact — a mixed flock is not a broiler flock")
  void flockFilterIsExact() {
    stored(
        answer(1, "SN", "Thiès", FlockType.BROILER, null, null),
        answer(2, "SN", "Thiès", FlockType.BOTH, null, null));

    assertThat(ids(service.search(null, null, FlockType.BROILER, false, PageRequest.of(0, 10))))
        .containsExactly(1L);
  }

  @Test
  @DisplayName("« accepts an interview » keeps only those who left a number to call")
  void interviewOnlyRequiresAReachableNumber() {
    stored(
        answer(1, "SN", "Thiès", FlockType.BROILER, "770000001", true),
        answer(2, "SN", "Thiès", FlockType.BROILER, null, true), // agreed, unreachable
        answer(3, "SN", "Thiès", FlockType.BROILER, "   ", true), // blank is unreachable
        answer(4, "SN", "Thiès", FlockType.BROILER, "770000004", false),
        answer(5, "SN", "Thiès", FlockType.BROILER, "770000005", null));

    assertThat(ids(service.search(null, null, null, true, PageRequest.of(0, 10))))
        .containsExactly(1L);
  }

  @Test
  @DisplayName("paging counts the matches, not the table")
  void pagingCountsTheMatches() {
    stored(
        answer(1, "SN", "Thiès", FlockType.BROILER, null, null),
        answer(2, "CI", "Abidjan", FlockType.BROILER, null, null),
        answer(3, "CI", "Bouaké", FlockType.BROILER, null, null));

    Page<SurveyAnswerRow> first = service.search("CI", null, null, false, PageRequest.of(0, 1));
    assertThat(first.getTotalElements()).isEqualTo(2);
    assertThat(ids(first)).containsExactly(3L);

    Page<SurveyAnswerRow> second = service.search("CI", null, null, false, PageRequest.of(1, 1));
    assertThat(ids(second)).containsExactly(2L);

    // A page past the end is empty, not an exception.
    assertThat(service.search("CI", null, null, false, PageRequest.of(9, 1)).getContent())
        .isEmpty();
  }

  @Test
  @DisplayName("the phone number is handed over, and the address hash never is")
  void rowCarriesThePhoneAndNeverTheAddressHash() {
    SurveyResponse a = answer(1, "SN", "Thiès", FlockType.BROILER, "770000001", true);
    a.setIpHash("deadbeef");
    stored(a);

    SurveyAnswerRow row =
        service.search(null, null, null, false, PageRequest.of(0, 10)).getContent().getFirst();
    assertThat(row.phone()).isEqualTo("770000001");
    assertThat(row.toString()).doesNotContain("deadbeef");
  }

  @Test
  @DisplayName("the summary reuses the floor the public page publishes at")
  void intakeUsesThePublicationFloor() {
    stored(answer(1, "SN", "Thiès", FlockType.BROILER, null, null));

    SurveyIntake intake = service.intake();
    assertThat(intake.publicationFloor()).isEqualTo(SurveyService.PUBLICATION_FLOOR);
    assertThat(intake.total()).isEqualTo(1);
  }
}
