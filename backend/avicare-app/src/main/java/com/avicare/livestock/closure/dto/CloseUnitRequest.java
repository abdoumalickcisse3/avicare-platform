package com.avicare.livestock.closure.dto;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Body of a closing request. The chick cost is optional — it is not recorded anywhere else in the
 * platform, and not every farmer knows it at closing time.
 */
public record CloseUnitRequest(@PositiveOrZero Long chickCostXof, @Size(max = 2000) String notes) {}
