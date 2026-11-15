package com.avicare.survey.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.api.response.PageResponse;
import com.avicare.survey.domain.FlockType;
import com.avicare.survey.dto.SurveyAnswerRow;
import com.avicare.survey.dto.SurveyIntake;
import com.avicare.survey.service.SurveyAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The field survey, read from the back-office.
 *
 * <p>Before this existed the answers had no reader at all: the public page shows a region's average
 * only once five answers back each figure, so the first four respondents were invisible to
 * everyone, their author included, and the only way in was a psql session on the production box.
 *
 * <p><b>Its own permission, {@code survey:read}.</b> Unlike the trace explorer next door, this does
 * not ride on {@code metrics:read}: these rows carry the phone numbers of people who are not
 * customers and never agreed to be in a product, so handing them to a staff member is a deliberate
 * grant and not a side effect of being able to see the cockpit.
 */
@RestController
@RequestMapping("/api/v1/admin/survey")
@RequiredArgsConstructor
public class AdminSurveyController {

  /**
   * The questionnaire is ~200 answers, and the console offers a CSV built from what it has on
   * screen. A cap of 200 lets one page hold the whole thing while still refusing an unbounded read.
   */
  private static final int MAX_PAGE_SIZE = 200;

  private final SurveyAdminService survey;

  @GetMapping("/intake")
  @PreAuthorize("@adminAccess.can('survey:read')")
  public ApiResponse<SurveyIntake> intake() {
    return ApiResponse.of(survey.intake());
  }

  @GetMapping("/answers")
  @PreAuthorize("@adminAccess.can('survey:read')")
  public PageResponse<SurveyAnswerRow> answers(
      @RequestParam(required = false) String country,
      @RequestParam(required = false) String region,
      @RequestParam(required = false) FlockType flockType,
      @RequestParam(defaultValue = "false") boolean interviewOnly,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size) {
    return PageResponse.from(
        survey.search(
            blankToNull(country),
            blankToNull(region),
            flockType,
            interviewOnly,
            PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE))));
  }

  /** An empty query parameter is "no filter", not a search for the empty string. */
  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
