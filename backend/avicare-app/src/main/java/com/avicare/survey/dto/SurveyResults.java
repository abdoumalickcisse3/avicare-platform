package com.avicare.survey.dto;

import com.avicare.survey.domain.SurveyResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * The aggregate given back to everyone who answered, and published openly.
 *
 * <p><b>The floor is the whole point.</b> A region with four answers does not get its own average —
 * it gets its country's, and the flag says so. Publishing a regional figure computed on three
 * people would put a number into the world that nobody could defend, which is the exact mistake
 * this survey exists to correct.
 *
 * <p>Countries never borrow from each other: a thin region in Senegal falls back to Senegal, never
 * to Côte d'Ivoire.
 */
public record SurveyResults(int totalResponses, int floor, List<AreaAverages> areas) {

  public static SurveyResults compute(List<SurveyResponse> answers, int floor) {
    Map<String, List<SurveyResponse>> byCountry = groupBy(answers, SurveyResponse::getCountry);

    List<AreaAverages> areas = new ArrayList<>();
    byCountry.forEach(
        (country, countryAnswers) ->
            groupBy(countryAnswers, SurveyResponse::getRegion)
                .forEach(
                    (region, regionAnswers) ->
                        areas.add(
                            regionAnswers.size() >= floor
                                ? averages(country, region, regionAnswers, false)
                                : averages(country, region, countryAnswers, true))));

    areas.sort(Comparator.comparing(AreaAverages::country).thenComparing(AreaAverages::region));
    return new SurveyResults(answers.size(), floor, List.copyOf(areas));
  }

  private static <K> Map<K, List<SurveyResponse>> groupBy(
      List<SurveyResponse> answers, Function<SurveyResponse, K> key) {
    Map<K, List<SurveyResponse>> grouped = new LinkedHashMap<>();
    for (SurveyResponse answer : answers) {
      K k = key.apply(answer);
      if (k != null) {
        grouped.computeIfAbsent(k, ignored -> new ArrayList<>()).add(answer);
      }
    }
    return grouped;
  }

  private static AreaAverages averages(
      String country, String region, List<SurveyResponse> source, boolean basedOnCountry) {
    return new AreaAverages(
        country,
        region,
        source.size(),
        basedOnCountry,
        mean(source, SurveyResponse::getLastBagPrice),
        count(source, r -> r.getLastBagPrice() != null),
        mean(source, SurveyResponse::getChickPrice),
        count(source, r -> r.getChickPrice() != null),
        mean(source, SurveyResults::partialCostPerBird),
        count(source, r -> partialCostPerBird(r) != null),
        mortality(source),
        count(source, r -> r.getBirdsPlaced() != null && r.getBirdsDied() != null));
  }

  /**
   * Chick plus feed, per bird that survived. Null unless every term is there and at least one bird
   * came out: a batch wiped out is a story for the interview, not a cost per head.
   */
  private static BigDecimal partialCostPerBird(SurveyResponse r) {
    if (r.getBirdsPlaced() == null
        || r.getChickPrice() == null
        || r.getFeedBags() == null
        || r.getLastBagPrice() == null) {
      return null;
    }
    int died = r.getBirdsDied() == null ? 0 : r.getBirdsDied();
    int survivors = r.getBirdsPlaced() - died;
    if (survivors <= 0) {
      return null;
    }
    BigDecimal chicks = r.getChickPrice().multiply(BigDecimal.valueOf(r.getBirdsPlaced()));
    BigDecimal feed = r.getLastBagPrice().multiply(BigDecimal.valueOf(r.getFeedBags()));
    return chicks.add(feed).divide(BigDecimal.valueOf(survivors), 0, RoundingMode.HALF_UP);
  }

  /** Dead over placed across the whole area, not the mean of each farm's rate. */
  private static BigDecimal mortality(List<SurveyResponse> source) {
    long placed = 0;
    long died = 0;
    for (SurveyResponse r : source) {
      if (r.getBirdsPlaced() != null && r.getBirdsDied() != null && r.getBirdsPlaced() > 0) {
        placed += r.getBirdsPlaced();
        died += r.getBirdsDied();
      }
    }
    if (placed == 0) {
      return null;
    }
    return BigDecimal.valueOf(died)
        .multiply(BigDecimal.valueOf(100))
        .divide(BigDecimal.valueOf(placed), 1, RoundingMode.HALF_UP);
  }

  /** Whole FCFA. Null when nobody in the area answered that question. */
  private static BigDecimal mean(
      List<SurveyResponse> source, Function<SurveyResponse, BigDecimal> field) {
    BigDecimal total = BigDecimal.ZERO;
    int n = 0;
    for (SurveyResponse r : source) {
      BigDecimal value = field.apply(r);
      if (value != null) {
        total = total.add(value);
        n++;
      }
    }
    return n == 0 ? null : total.divide(BigDecimal.valueOf(n), 0, RoundingMode.HALF_UP);
  }

  private static int count(List<SurveyResponse> source, Predicate<SurveyResponse> kept) {
    return (int) source.stream().filter(kept).count();
  }
}
