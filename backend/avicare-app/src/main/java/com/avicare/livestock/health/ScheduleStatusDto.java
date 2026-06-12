package com.avicare.livestock.health;

import java.time.LocalDate;

/**
 * Status of one scheduled vaccine for a unit's assigned program (Sprint B3-2): the due date
 * (computed as {@code unit.startDate + age}) and whether it is DONE, LATE or UPCOMING.
 */
public record ScheduleStatusDto(
    String vaccineKey,
    int ageValue,
    String ageUnit,
    LocalDate dueDate,
    Status status,
    boolean mandatory) {

  /** DONE: a matching vaccination exists. LATE: due before today, not done. UPCOMING: otherwise. */
  public enum Status {
    DONE,
    LATE,
    UPCOMING
  }
}
