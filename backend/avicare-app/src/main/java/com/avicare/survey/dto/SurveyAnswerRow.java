package com.avicare.survey.dto;

import com.avicare.survey.domain.SurveyResponse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * One answer, flattened for the back-office table — the questionnaire read back whole.
 *
 * <p>It is deliberately wide: the point of the screen is to read what somebody actually said, and a
 * summary of an answer is the one thing the public results page already gives.
 *
 * <p><b>Two things never leave the server.</b> {@code ip_hash} is an abuse signal, not data about a
 * person, and publishing it would let two answers be tied to one caller by anybody holding the
 * list. The database id is exposed, because a staff member needs something to quote when they
 * report a suspect row.
 *
 * <p>The phone number <b>is</b> here, in clear: it is the only way to call back the people who
 * agreed to an interview, which is why the question is asked at all.
 */
public record SurveyAnswerRow(
    Long id,
    LocalDateTime receivedAt,
    String country,
    String region,
    String commune,
    String referrer,
    String flockType,
    Integer currentBirds,
    Integer batchesLast12Months,
    Integer startedYear,
    Integer workers,
    LocalDate lastBatchMonth,
    Integer birdsPlaced,
    BigDecimal chickPrice,
    Integer birdsDied,
    Integer feedBags,
    BigDecimal lastBagPrice,
    String lastBagBrand,
    LocalDate lastBagMonth,
    String feedSupplier,
    String paymentTerms,
    Integer creditDays,
    Boolean creditCostsMore,
    String rawMaterialPrices,
    String mainBuyer,
    BigDecimal lastSalePrice,
    String lastSaleUnit,
    LocalDate lastSaleMonth,
    String paymentDelay,
    String firstCall,
    BigDecimal lastIncidentCost,
    String recordKeeping,
    String willingnessToPay,
    Boolean hasQuit,
    String quitReason,
    String phone,
    Boolean acceptsInterview) {

  public static SurveyAnswerRow from(SurveyResponse a) {
    return new SurveyAnswerRow(
        a.getId(),
        a.getCreatedAt(),
        a.getCountry(),
        a.getRegion(),
        a.getCommune(),
        a.getReferrer(),
        name(a.getFlockType()),
        a.getCurrentBirds(),
        a.getBatchesLast12Months(),
        a.getStartedYear(),
        a.getWorkers(),
        a.getLastBatchMonth(),
        a.getBirdsPlaced(),
        a.getChickPrice(),
        a.getBirdsDied(),
        a.getFeedBags(),
        a.getLastBagPrice(),
        a.getLastBagBrand(),
        a.getLastBagMonth(),
        a.getFeedSupplier(),
        name(a.getPaymentTerms()),
        a.getCreditDays(),
        a.getCreditCostsMore(),
        a.getRawMaterialPrices(),
        name(a.getMainBuyer()),
        a.getLastSalePrice(),
        name(a.getLastSaleUnit()),
        a.getLastSaleMonth(),
        name(a.getPaymentDelay()),
        name(a.getFirstCall()),
        a.getLastIncidentCost(),
        name(a.getRecordKeeping()),
        name(a.getWillingnessToPay()),
        a.getHasQuit(),
        a.getQuitReason(),
        a.getPhone(),
        a.getAcceptsInterview());
  }

  private static String name(Enum<?> value) {
    return value == null ? null : value.name();
  }
}
