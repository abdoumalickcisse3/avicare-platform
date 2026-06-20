package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.commercial.DeliveryFromOrderCommand;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Convert a confirmed (in-progress) order into a delivery (Sprint B5-5). The lines are taken in
 * full from the order (no partial delivery in V1, D23).
 */
public record DeliveryFromOrderRequest(
    @NotNull Long orderId,
    LocalDate deliveryDate,
    @Size(max = 150) String carrier,
    @Size(max = 2000) String notes) {

  public DeliveryFromOrderCommand toCommand() {
    return new DeliveryFromOrderCommand(deliveryDate, carrier, notes);
  }
}
