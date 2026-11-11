package com.avicare.survey.dto;

import java.math.BigDecimal;

/**
 * What is published back for one area, with the evidence behind it.
 *
 * <p>Every figure travels with the number of answers it rests on, and {@code basedOnCountry} says
 * out loud when the region did not have enough answers of its own and borrowed its country's. A
 * precise figure with a hidden sample size is how a 2007 number ended up being quoted as a 2026
 * one; this record exists so that cannot happen here.
 *
 * <p>Amounts are whole FCFA. {@code null} means nobody answered that question in this area.
 */
public record AreaAverages(
    String country,
    String region,
    int sampleSize,
    boolean basedOnCountry,
    BigDecimal feedBagPrice,
    int feedBagSampleSize,
    BigDecimal chickPrice,
    int chickPriceSampleSize,
    /**
     * Chick plus feed, divided by the birds that made it out alive. It is deliberately
     * <i>partial</i> — no labour, no vet, no heating, no building — because those are what the
     * sit-down interview is for. On the only full Senegalese measurement available, chick and feed
     * alone came to about 89 % of the total, so this is a floor, never a cost price.
     */
    BigDecimal partialCostPerBird,
    int partialCostSampleSize,
    BigDecimal mortalityPercent,
    int mortalitySampleSize) {}
