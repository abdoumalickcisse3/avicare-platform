package com.avicare.survey.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.api.web.ClientIp;
import com.avicare.survey.dto.SurveyResults;
import com.avicare.survey.dto.SurveySubmission;
import com.avicare.survey.service.SurveyService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The field survey, open to anyone with the link.
 *
 * <p><b>This is the platform's only unauthenticated write path.</b> It is deliberately narrow: one
 * POST that appends a row and can do nothing else, and one GET that returns averages already
 * aggregated — no row of it ever leaves the server. Three layers stand in front of the table: the
 * rate limiter (by address, before authentication), the honeypot, and a daily cap per address in
 * the service.
 *
 * <p>The GET is what the survey promises every respondent in exchange for their answers, so it is
 * public by design, not by oversight.
 */
@RestController
@RequestMapping("/api/v1/public/survey")
@RequiredArgsConstructor
public class PublicSurveyController {

  private final SurveyService surveyService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<Void> submit(
      @RequestBody @Valid SurveySubmission submission, HttpServletRequest request) {
    surveyService.record(submission, ClientIp.of(request));
    return ApiResponse.of(null);
  }

  @GetMapping("/results")
  public ApiResponse<SurveyResults> results() {
    return ApiResponse.of(surveyService.results());
  }
}
