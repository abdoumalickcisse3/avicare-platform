package com.avicare.livestock.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/** Body of the dedicated "record/correct the chick purchase cost" action. */
public record SetChickCostRequest(@NotNull @Positive Long chickUnitPriceXof) {}
