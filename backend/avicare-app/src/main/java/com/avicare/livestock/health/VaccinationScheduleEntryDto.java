package com.avicare.livestock.health;

/**
 * One step of a vaccination program: a target age ({@code DAY} or {@code WEEK}) at which a vaccine
 * is administered by a given route. Generic age + unit so B3-2 can compute the due date as {@code
 * startDate + age} without day/week-specific logic.
 */
public record VaccinationScheduleEntryDto(
    int ageValue, String ageUnit, String vaccineKey, String route, boolean mandatory) {}
