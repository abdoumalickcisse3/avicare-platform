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
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
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

  /**
   * The countries the questionnaire offers. Adding one means touching this list <i>and</i> the
   * select on the page — an allowlist that drifts from the form is an allowlist that lets anything
   * through.
   */
  public static final String COUNTRIES = "^(SN|CI|BJ|ML|BF|TG|NE|GN|CM|XX)$";

  /**
   * A place name, not a writing surface. Letters with their accents, digits, spaces, hyphens,
   * apostrophes and full stops — enough for Thiès, Saint-Louis and N'Djamena, and nothing that
   * could carry markup onto the public results page.
   */
  public static final String PLACE = "^[\\p{L}\\p{M}0-9 '\u2019.\\-]+$";

  public record Where(
      @NotBlank @Pattern(regexp = COUNTRIES) String country,
      @NotBlank @Size(max = 120) @Pattern(regexp = PLACE) String region,
      @Size(max = 120) @Pattern(regexp = PLACE) String commune,
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
      @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal chickPrice,
      @PositiveOrZero @Max(5_000_000) Integer birdsDied,
      @PositiveOrZero @Max(200_000) Integer feedBags,
      @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal lastBagPrice,
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
      @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal lastSalePrice,
      SaleUnit lastSaleUnit,
      LocalDate lastSaleMonth,
      PaymentDelay paymentDelay) {}

  public record Trouble(
      FirstCall firstCall,
      @PositiveOrZero @Digits(integer = 10, fraction = 2) BigDecimal lastIncidentCost) {}

  public record Tool(
      RecordKeeping recordKeeping,
      WillingnessToPay willingnessToPay,
      Boolean hasQuit,
      @Size(max = 1000) String quitReason) {}

  public record Contact(@Size(max = 32) String phone, Boolean acceptsInterview) {}
}
