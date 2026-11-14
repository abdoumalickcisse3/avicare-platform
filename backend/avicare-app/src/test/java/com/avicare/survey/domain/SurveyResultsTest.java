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
    List<SurveyResponse> answers =
        List.of(
            answer("SN", "Thiès", 17000),
            answer("SN", "Thiès", 18000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000),
            answer("SN", "Dakar", 20000));

    SurveyResults results = SurveyResults.compute(answers, FLOOR);

    AreaAverages thies =
        results.areas().stream().filter(a -> "Thiès".equals(a.region())).findFirst().orElseThrow();

    assertThat(thies.basedOnCountry()).isTrue();
    assertThat(thies.sampleSize()).isEqualTo(7);
    // 17 000 + 18 000 + 5 × 20 000 = 135 000, sur 7 réponses = 19 286
    assertThat(thies.feedBagPrice()).isEqualByComparingTo("19286");
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
