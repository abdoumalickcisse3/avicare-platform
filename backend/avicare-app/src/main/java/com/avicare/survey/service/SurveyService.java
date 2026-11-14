package com.avicare.survey.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.survey.domain.SurveyResponse;
import com.avicare.survey.dto.SurveyResults;
import com.avicare.survey.dto.SurveySubmission;
import com.avicare.survey.repository.SurveyResponseRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Takes in one questionnaire and gives back the aggregate.
 *
 * <p><b>This is the only write path open to the public internet.</b> Everything it does is shaped
 * by that: the answer is appended and never updated, the caller's address is reduced to a hash
 * before it touches the table, and a robot that trips the honeypot is told nothing.
 *
 * <p><b>Phone numbers are stored as typed.</b> Normalising to E.164 belongs to the notification
 * context, which is where the WhatsApp message is actually sent from; reaching into it from here
 * would be a cross-context import, and normalising twice is how the two copies start disagreeing.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SurveyService {

  /**
   * How many answers an area needs before its own average is published rather than its country's.
   * Five is a judgement call, not a statistic — it is low enough to show something early and high
   * enough that one outlier cannot carry a region.
   */
  public static final int PUBLICATION_FLOOR = 5;

  /**
   * How many answers one address may leave in a day. The rate limiter one layer up stops a flood
   * within the minute; this stops the patient one — somebody who sends the same answer twenty times
   * over an afternoon and quietly carries their own region's average. It protects the data, not the
   * server, which is why it lives here and not in a filter.
   */
  public static final int MAX_PER_ADDRESS_PER_DAY = 10;

  private final SurveyResponseRepository repository;

  @Transactional
  public void record(SurveySubmission submission, String clientIp) {
    if (submission.website() != null && !submission.website().isBlank()) {
      log.info("survey: honeypot tripped, answer dropped");
      return;
    }

    String ipHash = hash(clientIp);
    if (ipHash != null
        && repository.countByIpHashAndCreatedAtAfter(ipHash, LocalDateTime.now().minusDays(1))
            >= MAX_PER_ADDRESS_PER_DAY) {
      throw new BusinessRuleException(
          "SURVEY_DAILY_LIMIT",
          "Trop de réponses envoyées depuis cette connexion aujourd'hui. Réessayez demain.");
    }

    SurveyResponse answer = new SurveyResponse();
    answer.setIpHash(ipHash);

    SurveySubmission.Where where = submission.where();
    answer.setCountry(where.country().trim().toUpperCase());
    answer.setRegion(where.region().trim());
    answer.setCommune(trimmed(where.commune()));
    answer.setReferrer(trimmed(where.referrer()));

    SurveySubmission.Flock flock = submission.flock();
    answer.setFlockType(flock.type());
    answer.setCurrentBirds(flock.currentBirds());
    answer.setBatchesLast12Months(flock.batchesLast12Months());
    answer.setStartedYear(flock.startedYear());
    answer.setWorkers(flock.workers());

    SurveySubmission.LastBatch batch = submission.lastBatch();
    if (batch != null) {
      answer.setLastBatchMonth(batch.month());
      answer.setBirdsPlaced(batch.birdsPlaced());
      answer.setChickPrice(batch.chickPrice());
      answer.setBirdsDied(batch.birdsDied());
      answer.setFeedBags(batch.feedBags());
      answer.setLastBagPrice(batch.lastBagPrice());
      answer.setLastBagBrand(trimmed(batch.lastBagBrand()));
      answer.setLastBagMonth(batch.lastBagMonth());
    }

    SurveySubmission.Buying buying = submission.buying();
    if (buying != null) {
      answer.setFeedSupplier(trimmed(buying.feedSupplier()));
      answer.setPaymentTerms(buying.paymentTerms());
      answer.setCreditDays(buying.creditDays());
      answer.setCreditCostsMore(buying.creditCostsMore());
      answer.setRawMaterialPrices(trimmed(buying.rawMaterialPrices()));
    }

    SurveySubmission.Selling selling = submission.selling();
    if (selling != null) {
      answer.setMainBuyer(selling.mainBuyer());
      answer.setLastSalePrice(selling.lastSalePrice());
      answer.setLastSaleUnit(selling.lastSaleUnit());
      answer.setLastSaleMonth(selling.lastSaleMonth());
      answer.setPaymentDelay(selling.paymentDelay());
    }

    SurveySubmission.Trouble trouble = submission.trouble();
    if (trouble != null) {
      answer.setFirstCall(trouble.firstCall());
      answer.setLastIncidentCost(trouble.lastIncidentCost());
    }

    SurveySubmission.Tool tool = submission.tool();
    if (tool != null) {
      answer.setRecordKeeping(tool.recordKeeping());
      answer.setWillingnessToPay(tool.willingnessToPay());
      answer.setHasQuit(tool.hasQuit());
      answer.setQuitReason(trimmed(tool.quitReason()));
    }

    SurveySubmission.Contact contact = submission.contact();
    if (contact != null) {
      answer.setPhone(trimmed(contact.phone()));
      answer.setAcceptsInterview(contact.acceptsInterview());
    }

    repository.save(answer);
    published.set(null);
  }

  /**
   * How long the published figures may stand before being recomputed.
   *
   * <p>The results are read without a token, so the work they cost is whatever a stranger asks for.
   * Recomputing per call would hand that lever away; on a timer, the table is read at most once a
   * minute however hard the page is refreshed, and a new answer invalidates it anyway — so nobody
   * sees a stale figure after their own submission.
   */
  private static final Duration RESULTS_FRESHNESS = Duration.ofMinutes(1);

  private final AtomicReference<Published> published = new AtomicReference<>();

  private record Published(SurveyResults results, Instant computedAt) {}

  @Transactional(readOnly = true)
  public SurveyResults results() {
    Published current = published.get();
    if (current != null && current.computedAt().isAfter(Instant.now().minus(RESULTS_FRESHNESS))) {
      return current.results();
    }
    SurveyResults fresh = SurveyResults.compute(repository.findAll(), PUBLICATION_FLOOR);
    published.set(new Published(fresh, Instant.now()));
    return fresh;
  }

  private static String trimmed(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  /**
   * SHA-256 of the address. Enough to recognise the same caller twice, nothing to work backwards to
   * a person with — and the raw address never reaches the table.
   */
  private static String hash(String clientIp) {
    if (clientIp == null) {
      return null;
    }
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(clientIp.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 missing from the JVM", e);
    }
  }
}
