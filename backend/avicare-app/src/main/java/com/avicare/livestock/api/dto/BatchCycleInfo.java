package com.avicare.livestock.api.dto;

import java.time.LocalDate;

/**
 * An active broiler batch and the date it is expected to reach its slaughter target — the input a
 * partner needs to anticipate a restock (couche « Développer »).
 *
 * <p>{@code forecastMethod} says how {@code expectedEndDate} was obtained, and the caller is
 * expected to surface it: a partner must know whether it reads a projection built on the batch's
 * real growth or a plain theoretical age.
 *
 * <ul>
 *   <li>{@code GROWTH} — projected from the observed daily gain toward the target weight (a
 *       weighing exists).
 *   <li>{@code THEORETICAL} — {@code startDate + targetAgeDays}, no weighing to go on.
 * </ul>
 */
public record BatchCycleInfo(
    Long unitId,
    String name,
    int headcount,
    LocalDate startDate,
    LocalDate expectedEndDate,
    String forecastMethod) {

  public static final String METHOD_GROWTH = "GROWTH";
  public static final String METHOD_THEORETICAL = "THEORETICAL";
}
