package com.avicare.livestock.domain;

import java.math.BigDecimal;

/**
 * One ingredient of a {@link FeedFormula} (Sprint B4-4) — an article and its share of the mix.
 * Serialized inside the {@code ingredients} JSONB column (not a JPA entity). {@code percentage} is
 * a 0–100 share; for 100 kg of feed it is also the kilograms of this article. {@code articleSource}
 * is {@code INVENTORY} in V1 (kept for a future medicated-mix extension).
 */
public record FormulaIngredient(
    String articleKey, ArticleSource articleSource, BigDecimal percentage) {}
