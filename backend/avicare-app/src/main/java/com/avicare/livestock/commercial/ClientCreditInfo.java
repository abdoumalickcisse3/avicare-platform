package com.avicare.livestock.commercial;

/**
 * Public, read-only view of a client's credit standing (doc 03 §4.9). Exposed through {@link
 * CommercialFacade} so other parts of the app (finance, reporting, the REST layer) can surface
 * credit-overshoot alerts without reaching into the commercial services. {@code creditLimitXof}
 * null = no limit (in which case {@code overLimit} is false and {@code overLimitPercent} is null);
 * {@code currentBalanceXof} is the receivable (encours), which may be negative (advance).
 */
public record ClientCreditInfo(
    Long clientId,
    String displayName,
    Long creditLimitXof,
    long currentBalanceXof,
    boolean overLimit,
    Integer overLimitPercent) {}
