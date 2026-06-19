package com.avicare.livestock.commercial;

import java.time.LocalDate;

/**
 * Input to convert a confirmed order into a delivery (Sprint B5-2). The delivered lines are taken
 * in full from the order (no partial delivery in V1, D23). {@code deliveryDate} defaults to today
 * when null.
 */
public record DeliveryFromOrderCommand(LocalDate deliveryDate, String carrier, String notes) {}
