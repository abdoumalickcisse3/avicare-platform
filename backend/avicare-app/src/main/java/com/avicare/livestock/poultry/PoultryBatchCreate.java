package com.avicare.livestock.poultry;

import java.time.LocalDate;

/**
 * Command to create a {@link com.avicare.livestock.domain.PoultryBatch broiler batch}.
 *
 * <p>{@code chickUnitPriceXof} is optional (nullable) — the price paid per chick, used to record a
 * {@code CHICK_PURCHASE} expense at creation time. The secondary 7-arg constructor exists purely to
 * keep the 9 pre-existing positional call sites compiling; new callers should use the canonical
 * 8-arg constructor.
 */
public record PoultryBatchCreate(
    Long farmId,
    Long breedId,
    String name,
    LocalDate startDate,
    Integer targetWeightG,
    Integer targetAgeDays,
    int initialCount,
    Long chickUnitPriceXof) {

  public PoultryBatchCreate(
      Long farmId,
      Long breedId,
      String name,
      LocalDate startDate,
      Integer targetWeightG,
      Integer targetAgeDays,
      int initialCount) {
    this(farmId, breedId, name, startDate, targetWeightG, targetAgeDays, initialCount, null);
  }
}
