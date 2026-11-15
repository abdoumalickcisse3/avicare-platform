package com.avicare.survey.dto;

import com.avicare.survey.domain.SurveyResponse;
import java.time.LocalDate;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * What the collection looks like so far: how much came in, from where, through whom, and how far
 * each area still is from the floor that lets its own figures be published.
 *
 * <p>The last part is the one that earns the screen. The public page shows a region's average only
 * once {@link com.avicare.survey.service.SurveyService#PUBLICATION_FLOOR} answers back every
 * figure, so until then nobody — the respondents included — can see anything. This says exactly how
 * many answers are still missing, region by region, which is the number that tells somebody where
 * to push next.
 *
 * <p>Computed in memory from the whole table on purpose. A survey is bounded by design (a few
 * hundred answers, then it is over), the public results already read it whole, and three GROUP BY
 * round trips returning {@code Object[]} would be harder to read for no measurable gain.
 */
public record SurveyIntake(
    int total,
    int withPhone,
    int acceptingInterview,
    LocalDate lastAnswerOn,
    int publicationFloor,
    List<CountryCount> countries,
    List<AreaProgress> areas,
    List<ReferrerCount> referrers) {

  /** Answers per country, biggest first. */
  public record CountryCount(String country, int answers) {}

  /**
   * One area and its distance to publication.
   *
   * @param missingBeforePublication how many more answers this area needs; zero once it is over the
   *     floor — which does not promise every figure is published, since a figure nobody answered
   *     stays hidden whatever the count.
   */
  public record AreaProgress(
      String country, String region, int answers, int missingBeforePublication) {}

  /**
   * Who passed the link on, as the respondent typed it. Free text, so two spellings of one name are
   * two lines here — that is the cost of asking the question in a box instead of in the URL.
   */
  public record ReferrerCount(String referrer, int answers) {}

  public static SurveyIntake compute(Collection<SurveyResponse> answers, int floor) {
    List<CountryCount> countries =
        count(answers, SurveyResponse::getCountry).entrySet().stream()
            .map(e -> new CountryCount(e.getKey(), e.getValue()))
            .sorted(
                Comparator.comparingInt(CountryCount::answers)
                    .reversed()
                    .thenComparing(CountryCount::country))
            .toList();

    List<AreaProgress> areas =
        count(answers, a -> a.getCountry() + "\u0000" + a.getRegion()).entrySet().stream()
            .map(
                e -> {
                  String[] parts = e.getKey().split("\u0000", 2);
                  return new AreaProgress(
                      parts[0], parts[1], e.getValue(), Math.max(0, floor - e.getValue()));
                })
            .sorted(
                Comparator.comparingInt(AreaProgress::answers)
                    .reversed()
                    .thenComparing(AreaProgress::country)
                    .thenComparing(AreaProgress::region))
            .toList();

    List<ReferrerCount> referrers =
        count(answers, a -> blankToNull(a.getReferrer())).entrySet().stream()
            .map(e -> new ReferrerCount(e.getKey(), e.getValue()))
            .sorted(
                Comparator.comparingInt(ReferrerCount::answers)
                    .reversed()
                    .thenComparing(ReferrerCount::referrer))
            .toList();

    return new SurveyIntake(
        answers.size(),
        (int) answers.stream().filter(a -> blankToNull(a.getPhone()) != null).count(),
        (int) answers.stream().filter(a -> Boolean.TRUE.equals(a.getAcceptsInterview())).count(),
        answers.stream()
            .map(SurveyResponse::getCreatedAt)
            .filter(java.util.Objects::nonNull)
            .max(Comparator.naturalOrder())
            .map(java.time.LocalDateTime::toLocalDate)
            .orElse(null),
        floor,
        countries,
        areas,
        referrers);
  }

  /**
   * Counts by key, dropping the answers whose key is null. A blank "who sent you this" is not a
   * channel called "blank" — it is an answer that cannot be attributed, and inventing a bucket for
   * it would make the relay table lie about which name worked.
   */
  private static Map<String, Integer> count(
      Collection<SurveyResponse> answers, Function<SurveyResponse, String> key) {
    return answers.stream()
        .map(key)
        .filter(java.util.Objects::nonNull)
        .collect(Collectors.toMap(k -> k, k -> 1, Integer::sum));
  }

  private static String blankToNull(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }
}
