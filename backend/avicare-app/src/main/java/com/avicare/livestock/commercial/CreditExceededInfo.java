package com.avicare.livestock.commercial;

/**
 * Neutral, cross-context view of a client whose receivable (encours) exceeds its credit limit (D26,
 * informative), exposed through {@link CommercialFacade#clientsOverCredit(Long)} for the
 * notification context (Sprint C1).
 */
public record CreditExceededInfo(
    Long clientId, String clientName, long currentBalanceXof, long creditLimitXof) {}
