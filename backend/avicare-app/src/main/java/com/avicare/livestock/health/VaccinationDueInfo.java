package com.avicare.livestock.health;

import java.time.LocalDate;

/**
 * Public, read-only view of a vaccination that is due/overdue on a lot: the lot name, the vaccine
 * key, its {@code dueDate} and how many {@code daysLate} it is. Exposed through {@link
 * HealthFacade} so the assistant can answer "quelles vaccinations sont dues ?" without touching the
 * health services.
 */
public record VaccinationDueInfo(
    String unitName, String vaccineKey, LocalDate dueDate, long daysLate) {}
