package com.avicare.survey.service;

import com.avicare.survey.domain.FlockType;
import com.avicare.survey.domain.SurveyResponse;
import com.avicare.survey.dto.SurveyAnswerRow;
import com.avicare.survey.dto.SurveyIntake;
import com.avicare.survey.repository.SurveyResponseRepository;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads the survey back for platform staff — the counterpart of {@link SurveyService}, which only
 * ever takes answers in and gives the public average out.
 *
 * <p>Two services and not one, because the two have nothing in common but a table: {@link
 * SurveyService} is the single write path open to the public internet and is shaped by that, while
 * everything here sits behind {@code survey:read} and hands over what a respondent typed, their
 * phone number included. Mixing them would put the staff reads one annotation away from the open
 * road.
 *
 * <p><b>Filtering and paging happen in memory, deliberately.</b> A survey is bounded by design — a
 * few hundred answers and it is over — the public results already read the table whole, and one
 * read serving both the summary and the page means the two can never disagree. It also sidesteps
 * the JPQL null-guard dance this project has been bitten by. The day {@code survey_responses}
 * outgrows a comfortable read, the fix is a {@code Specification} and a real {@code Pageable}, not
 * a bigger heap: that is the line at which this choice stops being right.
 */
@Service
@RequiredArgsConstructor
public class SurveyAdminService {

  private final SurveyResponseRepository repository;

  /** How the collection stands: volume, origin, relays, and distance to publication. */
  @Transactional(readOnly = true)
  public SurveyIntake intake() {
    return SurveyIntake.compute(repository.findAll(), SurveyService.PUBLICATION_FLOOR);
  }

  /**
   * The answers themselves, newest first.
   *
   * <p>Ordered by id and not by {@code created_at}: the id is assigned by the sequence, never null,
   * and strictly increasing, so two answers landing in the same second still come back in a stable
   * order instead of swapping places between two pages.
   *
   * @param country ISO alpha-2, or null for every country
   * @param region matched as a case-insensitive fragment, or null for every region
   * @param flockType exact match, or null for every kind of flock
   * @param interviewOnly keep only the answers that agreed to an interview <i>and</i> left a number
   *     — the two together, because an agreement with no way to call back is not a lead
   */
  @Transactional(readOnly = true)
  public Page<SurveyAnswerRow> search(
      String country,
      String region,
      FlockType flockType,
      boolean interviewOnly,
      Pageable pageable) {
    List<SurveyResponse> matching =
        repository.findAll().stream()
            .filter(a -> country == null || country.equalsIgnoreCase(a.getCountry()))
            .filter(a -> region == null || containsIgnoreCase(a.getRegion(), region))
            .filter(a -> flockType == null || flockType == a.getFlockType())
            .filter(a -> !interviewOnly || isReachableLead(a))
            .sorted(Comparator.comparing(SurveyResponse::getId).reversed())
            .toList();

    int from = (int) Math.min(pageable.getOffset(), matching.size());
    int to = Math.min(from + pageable.getPageSize(), matching.size());
    List<SurveyAnswerRow> rows =
        matching.subList(from, to).stream().map(SurveyAnswerRow::from).toList();
    return new PageImpl<>(rows, pageable, matching.size());
  }

  private static boolean isReachableLead(SurveyResponse answer) {
    return Boolean.TRUE.equals(answer.getAcceptsInterview())
        && answer.getPhone() != null
        && !answer.getPhone().isBlank();
  }

  private static boolean containsIgnoreCase(String haystack, String needle) {
    return haystack != null && haystack.toLowerCase().contains(needle.toLowerCase());
  }
}
