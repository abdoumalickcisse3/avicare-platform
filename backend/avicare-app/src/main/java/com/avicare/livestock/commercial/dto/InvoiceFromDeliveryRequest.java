package com.avicare.livestock.commercial.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** Generate an invoice from a delivery (Sprint B5-5). {@code dueDate} optional. */
public record InvoiceFromDeliveryRequest(@NotNull Long deliveryId, LocalDate dueDate) {}
