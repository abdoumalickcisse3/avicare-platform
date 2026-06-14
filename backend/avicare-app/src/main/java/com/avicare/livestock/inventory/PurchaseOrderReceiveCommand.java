package com.avicare.livestock.inventory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Input to receive a SENT purchase order (Sprint B4-3). {@code actualDeliveryDate} defaults to
 * today when null. {@code lines} carries the received quantity per order line; a line absent from
 * the list is treated as received 0 (no stock movement).
 */
public record PurchaseOrderReceiveCommand(LocalDate actualDeliveryDate, List<LineReceipt> lines) {

  public record LineReceipt(Long itemId, BigDecimal receivedQuantity) {}
}
