package com.avicare.livestock.commercial.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/** Generate an invoice from a sale (Sprint B5-5). {@code dueDate} optional. */
public record InvoiceFromSaleRequest(@NotNull Long saleId, LocalDate dueDate) {}
