package com.avicare.finance.api;

/**
 * Public, read-only view of a farm's profit &amp; loss: {@code revenueXof} (direct sales + paid
 * delivery orders), {@code expenseXof} (all recorded expenses) and their {@code marginXof}
 * difference. Exposed through {@link FinanceFacade} so the assistant can answer "quel est mon
 * résultat ?" with the same figures the finance dashboard shows.
 */
public record FarmPnl(long revenueXof, long expenseXof, long marginXof) {}
