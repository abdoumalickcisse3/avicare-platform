package com.avicare.survey.repository;

import com.avicare.survey.domain.SurveyResponse;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;

/** Append-only store of field survey answers. Nothing here is ever updated or deleted. */
public interface SurveyResponseRepository extends JpaRepository<SurveyResponse, Long> {

  /**
   * How many answers one address has already left since a moment. The rate limiter stops a flood in
   * the same minute; this catches the patient robot that comes back every hour.
   */
  long countByIpHashAndCreatedAtAfter(String ipHash, LocalDateTime since);
}
