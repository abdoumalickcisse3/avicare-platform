package com.avicare.survey.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.survey.domain.FlockType;
import com.avicare.survey.domain.SurveyResponse;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The summary exists for one number: how many answers an area still needs before its own figures
 * are published. Everything else on the screen is a count; that one is a decision aid.
 */
class SurveyIntakeTest {

  private static final int FLOOR = 5;

  private static SurveyResponse answer(long id, String country, String region, String referrer) {
    SurveyResponse a = new SurveyResponse();
    a.setId(id);
    a.setCountry(country);
    a.setRegion(region);
    a.setReferrer(referrer);
    a.setFlockType(FlockType.BROILER);
    a.setCurrentBirds(200);
    a.setCreatedAt(LocalDateTime.of(2026, 11, 10, 8, 0).plusDays(id));
    return a;
  }

  @Test
  @DisplayName("an area under the floor says how many answers are still missing")
  void missingBeforePublication() {
    SurveyIntake intake =
        SurveyIntake.compute(
            List.of(
                answer(1, "SN", "Thiès", null),
                answer(2, "SN", "Thiès", null),
                answer(3, "CI", "Abidjan", null)),
            FLOOR);

    assertThat(intake.areas())
        .extracting(
            SurveyIntake.AreaProgress::region, SurveyIntake.AreaProgress::missingBeforePublication)
        .containsExactly(tuple("Thiès", 3), tuple("Abidjan", 4));
  }

  @Test
  @DisplayName("an area over the floor is at zero, never at a negative number")
  void overTheFloorNeverGoesNegative() {
    SurveyIntake intake =
        SurveyIntake.compute(
            List.of(
                answer(1, "SN", "Thiès", null),
                answer(2, "SN", "Thiès", null),
                answer(3, "SN", "Thiès", null),
                answer(4, "SN", "Thiès", null),
                answer(5, "SN", "Thiès", null),
                answer(6, "SN", "Thiès", null),
                answer(7, "SN", "Thiès", null)),
            FLOOR);

    assertThat(intake.areas())
        .singleElement()
        .satisfies(
            a -> {
              assertThat(a.answers()).isEqualTo(7);
              assertThat(a.missingBeforePublication()).isZero();
            });
  }

  @Test
  @DisplayName("two regions of the same name in two countries are two areas")
  void areasAreCountryPlusRegion() {
    SurveyIntake intake =
        SurveyIntake.compute(
            List.of(answer(1, "SN", "Centre", null), answer(2, "CI", "Centre", null)), FLOOR);

    assertThat(intake.areas()).hasSize(2);
    assertThat(intake.countries())
        .extracting(SurveyIntake.CountryCount::country)
        .containsExactlyInAnyOrder("SN", "CI");
  }

  @Test
  @DisplayName("a blank relay is not a relay called « blank » — it is simply unattributed")
  void blankReferrerIsNotABucket() {
    SurveyIntake intake =
        SurveyIntake.compute(
            List.of(
                answer(1, "SN", "Thiès", "Amadou"),
                answer(2, "SN", "Thiès", "Amadou"),
                answer(3, "SN", "Thiès", "   "),
                answer(4, "SN", "Thiès", null)),
            FLOOR);

    assertThat(intake.referrers())
        .extracting(SurveyIntake.ReferrerCount::referrer, SurveyIntake.ReferrerCount::answers)
        .containsExactly(tuple("Amadou", 2));
    // The two unattributed answers still count in the total.
    assertThat(intake.total()).isEqualTo(4);
  }

  @Test
  @DisplayName("counts the reachable leads and the last day something came in")
  void countsLeadsAndLastDay() {
    SurveyResponse withPhone = answer(1, "SN", "Thiès", null);
    withPhone.setPhone("770000001");
    withPhone.setAcceptsInterview(true);
    SurveyResponse agreedNoPhone = answer(2, "SN", "Thiès", null);
    agreedNoPhone.setAcceptsInterview(true);

    SurveyIntake intake = SurveyIntake.compute(List.of(withPhone, agreedNoPhone), FLOOR);

    assertThat(intake.withPhone()).isEqualTo(1);
    assertThat(intake.acceptingInterview()).isEqualTo(2);
    assertThat(intake.lastAnswerOn()).isEqualTo(LocalDate.of(2026, 11, 12));
  }

  @Test
  @DisplayName("an empty collection is a legitimate state, not an error")
  void emptyIsAState() {
    SurveyIntake intake = SurveyIntake.compute(List.of(), FLOOR);

    assertThat(intake.total()).isZero();
    assertThat(intake.areas()).isEmpty();
    assertThat(intake.countries()).isEmpty();
    assertThat(intake.referrers()).isEmpty();
    assertThat(intake.lastAnswerOn()).isNull();
    assertThat(intake.publicationFloor()).isEqualTo(FLOOR);
  }

  private static org.assertj.core.groups.Tuple tuple(Object... values) {
    return org.assertj.core.groups.Tuple.tuple(values);
  }
}
