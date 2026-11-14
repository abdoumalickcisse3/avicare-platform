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

/**
 * The aggregate given back to everyone who answered, and published openly.
 *
 * <p><b>Three rules keep a published average from naming the person behind it</b>, and all three
 * are needed — each one closes a door the previous two leave open.
 *
 * <ol>
 *   <li><b>A figure answered by fewer than {@code floor} people is never published.</b> Applied per
 *       figure, not per card: a region can clear the floor on answers and still be one person on
 *       the price of a bag of feed.
 *   <li><b>A country below the floor publishes nothing at all</b>, fallback included. With one
 *       answer, the "average" is that person's own price list.
 *   <li><b>The country fallback is offered only when what remains is itself a crowd.</b> Publish a
 *       region of nine and hand the country figure of ten to the tenth, and the tenth person's
 *       prices come back by subtraction. The remainder is checked per figure too, for the same
 *       reason as rule 1.
 * </ol>
 *
 * <p>Countries never borrow from each other: a thin region in Senegal falls back to Senegal, never
 * to Côte d'Ivoire.
 */
public record SurveyResults(int totalResponses, int floor, List<AreaAverages> areas) {

  public static SurveyResults compute(List<SurveyResponse> answers, int floor) {
    List<AreaAverages> areas = new ArrayList<>();

    groupBy(answers, SurveyResponse::getCountry)
        .forEach(
            (country, countryAnswers) -> {
              if (countryAnswers.size() < floor) {
                return; // rule 2
              }
              Map<String, List<SurveyResponse>> byRegion =
                  groupBy(countryAnswers, SurveyResponse::getRegion);

              List<List<SurveyResponse>> publishedOnTheirOwn =
                  byRegion.values().stream().filter(group -> group.size() >= floor).toList();

              int remainingAnswers =
                  countryAnswers.size() - publishedOnTheirOwn.stream().mapToInt(List::size).sum();
              boolean fallbackIsSafe = remainingAnswers >= floor;

              Figures countryFigures =
                  Figures.of(countryAnswers)
                      .floored(floor)
                      .minus(Figures.of(flatten(publishedOnTheirOwn)), floor);

              byRegion.forEach(
                  (region, regionAnswers) -> {
                    if (regionAnswers.size() >= floor) {
                      areas.add(
                          new AreaAverages(
                              country,
                              region,
                              regionAnswers.size(),
                              false,
                              Figures.of(regionAnswers).floored(floor)));
                    } else if (fallbackIsSafe) {
                      areas.add(
                          new AreaAverages(
                              country, region, countryAnswers.size(), true, countryFigures));
                    }
                    // Otherwise the region is absent: there is no figure publishable about it that
                    // does not publish the person.
                  });
            });

    areas.sort(Comparator.comparing(AreaAverages::country).thenComparing(AreaAverages::region));
    return new SurveyResults(answers.size(), floor, List.copyOf(areas));
  }

  // ---------------------------------------------------------------- figures

  /** One published number and how many answers it rests on. */
  record Figure(BigDecimal value, int sampleSize) {
    static final Figure NONE = new Figure(null, 0);

    /** Withheld when too few people answered this particular question. */
    Figure floored(int floor) {
      return sampleSize >= floor ? this : new Figure(null, sampleSize);
    }

    /**
     * Withheld when subtracting what is already published separately leaves too few people behind
     * this figure — that remainder is exactly what a reader could isolate.
     */
    Figure minus(Figure alreadyPublished, int floor) {
      if (value == null) {
        return this;
      }
      return sampleSize - alreadyPublished.sampleSize() >= floor
          ? this
          : new Figure(null, sampleSize);
    }
  }

  /** The four numbers an area publishes, each with its own sample. */
  record Figures(Figure feedBag, Figure chick, Figure partialCost, Figure mortality) {

    static Figures of(List<SurveyResponse> source) {
      return new Figures(
          mean(source, SurveyResponse::getLastBagPrice),
          mean(source, SurveyResponse::getChickPrice),
          mean(source, Figures::partialCostPerBird),
          mortality(source));
    }

    Figures floored(int floor) {
      return new Figures(
          feedBag.floored(floor),
          chick.floored(floor),
          partialCost.floored(floor),
          mortality.floored(floor));
    }

    Figures minus(Figures alreadyPublished, int floor) {
      return new Figures(
          feedBag.minus(alreadyPublished.feedBag(), floor),
          chick.minus(alreadyPublished.chick(), floor),
          partialCost.minus(alreadyPublished.partialCost(), floor),
          mortality.minus(alreadyPublished.mortality(), floor));
    }

    /**
     * Chick plus feed, per bird that survived. Absent unless every term is there and at least one
     * bird came out: a batch wiped out is a story for the interview, not a cost per head.
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
    private static Figure mortality(List<SurveyResponse> source) {
      long placed = 0;
      long died = 0;
      int n = 0;
      for (SurveyResponse r : source) {
        if (r.getBirdsPlaced() != null && r.getBirdsDied() != null && r.getBirdsPlaced() > 0) {
          placed += r.getBirdsPlaced();
          died += r.getBirdsDied();
          n++;
        }
      }
      if (placed == 0) {
        return Figure.NONE;
      }
      return new Figure(
          BigDecimal.valueOf(died)
              .multiply(BigDecimal.valueOf(100))
              .divide(BigDecimal.valueOf(placed), 1, RoundingMode.HALF_UP),
          n);
    }

    /** Whole FCFA. Absent when nobody in the area answered that question. */
    private static Figure mean(
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
      return n == 0
          ? Figure.NONE
          : new Figure(total.divide(BigDecimal.valueOf(n), 0, RoundingMode.HALF_UP), n);
    }
  }

  // ---------------------------------------------------------------- helpers

  private static List<SurveyResponse> flatten(List<List<SurveyResponse>> groups) {
    List<SurveyResponse> all = new ArrayList<>();
    groups.forEach(all::addAll);
    return all;
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
}
