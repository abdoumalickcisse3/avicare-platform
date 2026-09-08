package com.avicare.livestock.api.dto;

/**
 * An abnormal day of deaths on one lot, as judged against that lot's own recent history.
 *
 * <p>Detection is deliberately relative, not a fixed rate: two deaths a day is routine on a
 * 5&nbsp;000-bird flock and alarming on a flock of forty. What matters to a farmer is the
 * <em>break</em> — the morning the count stops looking like the mornings before it.
 *
 * @param unitId the lot
 * @param unitName the lot's name, so the message names it
 * @param deaths deaths recorded on the day that broke the pattern
 * @param baseline the lot's recent daily average, rounded, that the day is compared against
 */
public record MortalitySpike(Long unitId, String unitName, long deaths, long baseline) {}
