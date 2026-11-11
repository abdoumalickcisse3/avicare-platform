package com.avicare.survey.dto;

import com.avicare.survey.domain.FirstCall;
import com.avicare.survey.domain.FlockType;
import com.avicare.survey.domain.MainBuyer;
import com.avicare.survey.domain.PaymentDelay;
import com.avicare.survey.domain.PaymentTerms;
import com.avicare.survey.domain.RecordKeeping;
import com.avicare.survey.domain.SaleUnit;
import com.avicare.survey.domain.WillingnessToPay;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One filled-in questionnaire, grouped the way the page asks it — one block per screen.
 *
 * <p>Only the first two blocks are required. Everything after them may arrive null: a respondent
 * who stops at the third screen still told us where they are and what they keep, and that is worth
 * storing. Refusing the whole answer over a blank would cost more than the blank does.
 */
public record SurveySubmission(
    @NotNull @Valid Where where,
    @NotNull @Valid Flock flock,
    @Valid LastBatch lastBatch,
    @Valid Buying buying,
    @Valid Selling selling,
    @Valid Trouble trouble,
    @Valid Tool tool,
    @Valid Contact contact,
    /**
     * The honeypot. Hidden from people by the page, irresistible to a form-filling robot. Anything
     * here and the answer is dropped without a word — the sender still gets a 200, so a robot
     * learns nothing from trying again.
     */
    @Size(max = 200) String website) {

  public record Where(
      @NotBlank @Size(min = 2, max = 2) String country,
      @NotBlank @Size(max = 120) String region,
      @Size(max = 120) String commune,
      @Size(max = 200) String referrer) {}

  public record Flock(
      @NotNull FlockType type,
      @NotNull @PositiveOrZero @Max(5_000_000) Integer currentBirds,
      @PositiveOrZero @Max(100) Integer batchesLast12Months,
      @Min(1900) @Max(2100) Integer startedYear,
      @PositiveOrZero @Max(10_000) Integer workers) {}

  public record LastBatch(
      LocalDate month,
      @PositiveOrZero @Max(5_000_000) Integer birdsPlaced,
      @PositiveOrZero BigDecimal chickPrice,
      @PositiveOrZero @Max(5_000_000) Integer birdsDied,
      @PositiveOrZero @Max(200_000) Integer feedBags,
      @PositiveOrZero BigDecimal lastBagPrice,
      @Size(max = 120) String lastBagBrand,
      LocalDate lastBagMonth) {}

  public record Buying(
      @Size(max = 200) String feedSupplier,
      PaymentTerms paymentTerms,
      @PositiveOrZero @Max(3650) Integer creditDays,
      Boolean creditCostsMore,
      @Size(max = 1000) String rawMaterialPrices) {}

  public record Selling(
      MainBuyer mainBuyer,
      @PositiveOrZero BigDecimal lastSalePrice,
      SaleUnit lastSaleUnit,
      LocalDate lastSaleMonth,
      PaymentDelay paymentDelay) {}

  public record Trouble(FirstCall firstCall, @PositiveOrZero BigDecimal lastIncidentCost) {}

  public record Tool(
      RecordKeeping recordKeeping,
      WillingnessToPay willingnessToPay,
      Boolean hasQuit,
      @Size(max = 1000) String quitReason) {}

  public record Contact(@Size(max = 32) String phone, Boolean acceptsInterview) {}
}
