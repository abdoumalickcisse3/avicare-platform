package com.avicare.livestock.api.dto;

/**
 * Farm-level inventory KPIs for the dashboard's stock block (the record it used to leave empty).
 *
 * <p>{@code pricedArticles} / {@code totalArticles} is the valuation coverage, and it is served
 * rather than hidden: {@code typical_unit_price_xof} is nullable, so an article without a price
 * contributes nothing to {@code stockValueXof}. Reporting the total alone would understate it, and
 * always in the same direction.
 *
 * @param lowStockCount articles at or below their alert threshold
 * @param stockValueXof value of what is on hand, in whole XOF
 * @param pricedArticles active articles a price could be found for
 * @param totalArticles active articles held by the farm
 * @param consumedValueXof value of what left stock over the dashboard period
 */
public record InventoryStats(
    long lowStockCount,
    long stockValueXof,
    int pricedArticles,
    int totalArticles,
    long consumedValueXof) {}
