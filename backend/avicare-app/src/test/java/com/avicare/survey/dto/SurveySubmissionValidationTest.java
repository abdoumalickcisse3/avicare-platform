package com.avicare.survey.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.survey.domain.FlockType;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Anyone on the internet can post one of these, and what comes back out is published on a public
 * page beside a region name. So the bounds here are not form politeness — they are the line between
 * a survey and an open writing surface.
 */
class SurveySubmissionValidationTest {

  private static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
  private static final Validator VALIDATOR = FACTORY.getValidator();

  private static SurveySubmission with(SurveySubmission.Where where, SurveySubmission.LastBatch b) {
    return new SurveySubmission(
        where,
        new SurveySubmission.Flock(FlockType.BROILER, 450, null, null, null),
        b,
        null,
        null,
        null,
        null,
        null,
        null);
  }

  private static SurveySubmission.Where where(String country, String region) {
    return new SurveySubmission.Where(country, region, null, null);
  }

  @Test
  @DisplayName("a well formed answer passes")
  void aNormalAnswerPasses() {
    assertThat(VALIDATOR.validate(with(where("SN", "Thiès"), null))).isEmpty();
  }

  @Test
  @DisplayName("a region carrying markup is refused")
  void markupInARegionIsRefused() {
    assertThat(VALIDATOR.validate(with(where("SN", "<img src=x onerror=alert(1)>"), null)))
        .isNotEmpty();
  }

  @Test
  @DisplayName("a country outside the list is refused")
  void unknownCountryIsRefused() {
    assertThat(VALIDATOR.validate(with(where("ZZ", "Thiès"), null))).isNotEmpty();
  }

  @Test
  @DisplayName("a price too large for the column is refused here, not by the database")
  void absurdPriceIsRefused() {
    SurveySubmission.LastBatch batch =
        new SurveySubmission.LastBatch(
            null, 500, new BigDecimal("99999999999999"), null, null, null, null, null);

    assertThat(VALIDATOR.validate(with(where("SN", "Thiès"), batch))).isNotEmpty();
  }

  @Test
  @DisplayName("ordinary place names with accents, hyphens and apostrophes still pass")
  void realPlaceNamesPass() {
    for (String region : new String[] {"Thiès", "Saint-Louis", "N'Djamena", "Grand-Bassam"}) {
      assertThat(VALIDATOR.validate(with(where("SN", region), null)))
          .as("region %s", region)
          .isEmpty();
    }
  }
}
