package com.avicare.survey.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.survey.dto.AreaAverages;
import com.avicare.survey.dto.SurveyResults;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The promise made to every respondent is "you will get the average for your region". That promise
 * is only honest when the region actually has enough answers behind it; below the floor the figure
 * published is the country's, and it says so.
 */
class SurveyResultsTest {

  private static final int FLOOR = 5;

  private static SurveyResponse answer(String country, String region, long bagPrice) {
    SurveyResponse r = new SurveyResponse();
    r.setCountry(country);
    r.setRegion(region);
    r.setLastBagPrice(BigDecimal.valueOf(bagPrice));
    return r;
  }

  @Test
  @DisplayName("a region under the floor publishes the country figure, flagged as such")
  void regionUnderFloorFallsBackToCountry() {
    // Dix réponses : Dakar (5) est publiée seule, et il reste cinq personnes derrière Thiès et
    // Kaolack — assez pour qu'aucune ne soit isolable par soustraction.
    List<SurveyResponse> answers =
        List.of(
            answer("SN", "Thiès", 17000),
            answer("SN", "Thiès", 18000),
            answer("SN", "Kaolack", 19000),
            answer("SN", "Kaolack", 19000),
            answer("SN", "Kaolack", 19000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000));

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    AreaAverages thies =
        results.areas().stream().filter(a -> "Thiès".equals(a.region())).findFirst().orElseThrow();

    assertThat(thies.basedOnCountry()).isTrue();
    assertThat(thies.sampleSize()).isEqualTo(10);
    // 17 000 + 18 000 + 3 × 19 000 + 5 × 20 000 = 192 000, sur 10 réponses = 19 200
    assertThat(thies.feedBagPrice()).isEqualByComparingTo("19200");
  }

  @Test
  @DisplayName("a region at the floor publishes its own figure")
  void regionAtFloorKeepsItsOwnFigure() {
    List<SurveyResponse> answers =
        List.of(
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Thiès", 10000));

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    AreaAverages dakar =
        results.areas().stream().filter(a -> "Dakar".equals(a.region())).findFirst().orElseThrow();

    assertThat(dakar.basedOnCountry()).isFalse();
    assertThat(dakar.sampleSize()).isEqualTo(5);
    assertThat(dakar.feedBagPrice()).isEqualByComparingTo("20000");
  }

  @Test
  @DisplayName("countries never borrow from each other")
  void countriesAreNeverMixed() {
    List<SurveyResponse> answers =
        List.of(
            answer("SN", "Thiès", 17000),
            answer("SN", "Thiès", 17000),
            answer("SN", "Thiès", 17000),
            answer("SN", "Thiès", 17000),
            answer("SN", "Thiès", 17000),
            answer("CI", "Abidjan", 30000),
            answer("CI", "Abidjan", 30000),
            answer("CI", "Abidjan", 30000),
            answer("CI", "Abidjan", 30000),
            answer("CI", "Abidjan", 30000));

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    AreaAverages thies =
        results.areas().stream().filter(a -> "Thiès".equals(a.region())).findFirst().orElseThrow();

    assertThat(thies.feedBagPrice()).isEqualByComparingTo("17000");
  }

  @Test
  @DisplayName("a country under the floor publishes nothing at all")
  void countryUnderFloorPublishesNothing() {
    // Three answers in one country. Falling back to the country figure would publish an average
    // computed on three people — and with one answer, the "average" IS that person's price list.
    List<SurveyResponse> answers =
        List.of(
            answer("SN", "Thiès", 17000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Kaolack", 19000));

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    assertThat(results.areas()).isEmpty();
    assertThat(results.totalResponses()).isEqualTo(3);
  }

  /**
   * The floor alone does not protect a lone respondent. If a region is published on its own and the
   * rest of the country is one person, then the country figure handed to that person's region is
   * their own price list, recoverable by subtracting the published region from it. So the fallback
   * is only offered when what remains after the published regions is itself a crowd.
   */
  @Test
  @DisplayName(
      "the country fallback is withheld when subtracting the published regions leaves one person")
  void fallbackIsWithheldWhenTheRemainderIsThin() {
    List<SurveyResponse> answers = new java.util.ArrayList<>();
    for (int i = 0; i < 9; i++) {
      answers.add(answer("SN", "Dakar", 20000));
    }
    answers.add(answer("SN", "Thiès", 31000));

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    assertThat(results.areas()).extracting(AreaAverages::region).containsExactly("Dakar");
    assertThat(results.areas()).extracting(AreaAverages::basedOnCountry).containsExactly(false);
    // Dakar's own figure must not be contaminated either: 20 000, not the country's 21 100.
    assertThat(results.areas().getFirst().feedBagPrice()).isEqualByComparingTo("20000");
  }

  /**
   * A region can clear the floor on answers and still be a single person on one question. The floor
   * is therefore applied to every figure separately, not once to the card.
   */
  @Test
  @DisplayName(
      "a figure only two people answered is withheld, even in a region that cleared the floor")
  void aFigureAnsweredByTooFewIsWithheld() {
    List<SurveyResponse> answers = new java.util.ArrayList<>();
    for (int i = 0; i < 4; i++) {
      SurveyResponse silent = answer("SN", "Dakar", 0);
      silent.setLastBagPrice(null);
      answers.add(silent);
    }
    answers.add(answer("SN", "Dakar", 20000));
    answers.add(answer("SN", "Dakar", 20000));

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    AreaAverages dakar = results.areas().getFirst();
    assertThat(dakar.sampleSize()).isEqualTo(6);
    assertThat(dakar.feedBagPrice()).isNull();
  }

  @Test
  @DisplayName("a figure whose remainder is one person is withheld from the country fallback")
  void perFigureRemainderIsCheckedToo() {
    List<SurveyResponse> answers = new java.util.ArrayList<>();
    for (int i = 0; i < 5; i++) {
      answers.add(answer("SN", "Dakar", 20000));
    }
    // Un seul répondant hors de Dakar a donné un prix : pays 6 − Dakar 5 = 1.
    answers.add(answer("SN", "Thiès", 31000));
    SurveyResponse silentThies = answer("SN", "Thiès", 0);
    silentThies.setLastBagPrice(null);
    answers.add(silentThies);
    for (int i = 0; i < 3; i++) {
      SurveyResponse silent = answer("SN", "Kaolack", 0);
      silent.setLastBagPrice(null);
      answers.add(silent);
    }

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    AreaAverages thies =
        results.areas().stream().filter(a -> "Thiès".equals(a.region())).findFirst().orElseThrow();

    assertThat(thies.basedOnCountry()).isTrue();
    assertThat(thies.feedBagPrice()).isNull();
  }

  @Test
  @DisplayName("the fallback stands when several thin regions hide each other")
  void fallbackStandsWhenThinRegionsCoverEachOther() {
    List<SurveyResponse> answers = new java.util.ArrayList<>();
    for (int i = 0; i < 10; i++) {
      answers.add(answer("SN", "Dakar", 20000));
    }
    for (int i = 0; i < 3; i++) {
      answers.add(answer("SN", "Thiès", 17000));
    }
    for (int i = 0; i < 3; i++) {
      answers.add(answer("SN", "Kaolack", 18000));
    }

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    // Six people remain once Dakar is set aside: no single answer can be isolated.
    assertThat(results.areas()).extracting(AreaAverages::region).contains("Thiès", "Kaolack");
  }

  @Test
  @DisplayName("a thin region in a country that reaches the floor still gets the country figure")
  void thinRegionInAWellCoveredCountryStillPublishes() {
    List<SurveyResponse> answers =
        List.of(
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Thiès", 20000));

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    AreaAverages thies =
        results.areas().stream().filter(a -> "Thiès".equals(a.region())).findFirst().orElseThrow();

    assertThat(thies.basedOnCountry()).isTrue();
    assertThat(thies.sampleSize()).isEqualTo(5);
  }

  @Test
  @DisplayName("an answer that left the price blank is counted nowhere")
  void blankPricesDoNotDragTheAverageDown() {
    SurveyResponse blank = answer("SN", "Dakar", 0);
    blank.setLastBagPrice(null);

    List<SurveyResponse> answers =
        List.of(
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            blank);

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    AreaAverages dakar =
        results.areas().stream().filter(a -> "Dakar".equals(a.region())).findFirst().orElseThrow();

    assertThat(dakar.feedBagPrice()).isEqualByComparingTo("20000");
    assertThat(dakar.feedBagSampleSize()).isEqualTo(5);
    assertThat(dakar.sampleSize()).isEqualTo(6);
  }
}
