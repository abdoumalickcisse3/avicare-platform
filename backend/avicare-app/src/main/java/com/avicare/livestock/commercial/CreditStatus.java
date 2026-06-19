package com.avicare.livestock.commercial;

/**
 * Indicative credit snapshot for a client (Sprint B5-1, Décision D26 — informative, never blocks).
 * {@code creditLimitXof} null means no limit, in which case {@code overLimit} is always false and
 * {@code overLimitPercent} is null. {@code projectedBalanceXof} is the current receivable plus any
 * amount a pending operation would add.
 */
public record CreditStatus(
    boolean overLimit, long projectedBalanceXof, Long creditLimitXof, Integer overLimitPercent) {}
