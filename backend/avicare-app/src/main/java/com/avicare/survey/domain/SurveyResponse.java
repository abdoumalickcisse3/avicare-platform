package com.avicare.survey.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One answer to the field survey, as the respondent typed it.
 *
 * <p><b>Append-only.</b> There is no {@code deleted_at} and nothing here is ever updated: a survey
 * answer is not corrected, a second one is received. That is also why the entity carries no farm
 * and no tenant — a respondent is not a customer, and most of them never will be.
 *
 * <p><b>Everything is nullable except where a question is marked required.</b> A respondent who
 * skips the price of their last bag still tells us where they are and what they keep; dropping the
 * whole answer over one blank field would cost more than the blank does.
 *
 * <p>Timestamps are DB-owned (trigger), per the project's rule.
 */
@Entity
@Table(name = "survey_responses")
@Getter
@Setter
@NoArgsConstructor
public class SurveyResponse {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  // --- where ---------------------------------------------------------------

  /** ISO 3166-1 alpha-2, upper case. Required: a price without a country is unusable. */
  @Column(nullable = false, length = 2)
  private String country;

  @Column(nullable = false)
  private String region;

  @Column private String commune;

  /** Who passed the link on. Free text on purpose — it measures channels, it does not filter. */
  @Column private String referrer;

  // --- the flock -----------------------------------------------------------

  @Enumerated(EnumType.STRING)
  @Column(name = "flock_type", nullable = false)
  private FlockType flockType;

  /** An exact count, never a bracket: "under 500" hides the difference between 20 and 499. */
  @Column(name = "current_birds", nullable = false)
  private Integer currentBirds;

  @Column(name = "batches_last_12_months")
  private Integer batchesLast12Months;

  @Column(name = "started_year")
  private Integer startedYear;

  @Column(name = "workers")
  private Integer workers;

  // --- the last batch ------------------------------------------------------

  /** First day of the month the batch was placed; only the month is asked for. */
  @Column(name = "last_batch_month")
  private LocalDate lastBatchMonth;

  @Column(name = "birds_placed")
  private Integer birdsPlaced;

  @Column(name = "chick_price", precision = 12, scale = 2)
  private BigDecimal chickPrice;

  /** A count of dead birds, never a percentage — the two disagree badly in the literature. */
  @Column(name = "birds_died")
  private Integer birdsDied;

  @Column(name = "feed_bags")
  private Integer feedBags;

  @Column(name = "last_bag_price", precision = 12, scale = 2)
  private BigDecimal lastBagPrice;

  @Column(name = "last_bag_brand")
  private String lastBagBrand;

  @Column(name = "last_bag_month")
  private LocalDate lastBagMonth;

  // --- buying --------------------------------------------------------------

  @Column(name = "feed_supplier")
  private String feedSupplier;

  @Enumerated(EnumType.STRING)
  @Column(name = "payment_terms")
  private PaymentTerms paymentTerms;

  @Column(name = "credit_days")
  private Integer creditDays;

  /** Null means "I don't know", which is itself the answer for most of them. */
  @Column(name = "credit_costs_more")
  private Boolean creditCostsMore;

  @Column(name = "raw_material_prices", length = 1000)
  private String rawMaterialPrices;

  // --- selling -------------------------------------------------------------

  @Enumerated(EnumType.STRING)
  @Column(name = "main_buyer")
  private MainBuyer mainBuyer;

  @Column(name = "last_sale_price", precision = 12, scale = 2)
  private BigDecimal lastSalePrice;

  @Enumerated(EnumType.STRING)
  @Column(name = "last_sale_unit")
  private SaleUnit lastSaleUnit;

  @Column(name = "last_sale_month")
  private LocalDate lastSaleMonth;

  @Enumerated(EnumType.STRING)
  @Column(name = "payment_delay")
  private PaymentDelay paymentDelay;

  // --- when it goes wrong --------------------------------------------------

  @Enumerated(EnumType.STRING)
  @Column(name = "first_call")
  private FirstCall firstCall;

  @Column(name = "last_incident_cost", precision = 12, scale = 2)
  private BigDecimal lastIncidentCost;

  // --- the tool ------------------------------------------------------------

  @Enumerated(EnumType.STRING)
  @Column(name = "record_keeping")
  private RecordKeeping recordKeeping;

  @Enumerated(EnumType.STRING)
  @Column(name = "willingness_to_pay")
  private WillingnessToPay willingnessToPay;

  @Column(name = "has_quit")
  private Boolean hasQuit;

  @Column(name = "quit_reason", length = 1000)
  private String quitReason;

  // --- the return promise --------------------------------------------------

  /** E.164 where it could be normalised. Kept to send the results back, nothing else. */
  @Column private String phone;

  @Column(name = "accepts_interview")
  private Boolean acceptsInterview;

  // --- abuse ---------------------------------------------------------------

  /**
   * A hash of the caller's address, never the address. Enough to spot a flood, nothing to identify
   * anyone with.
   */
  @Column(name = "ip_hash", length = 64)
  private String ipHash;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;
}
