package com.avicare.livestock.inventory.dto;

import jakarta.validation.constraints.Size;

/** Cancel a purchase order with an optional reason (Sprint B4-6). */
public record PurchaseOrderCancelRequest(@Size(max = 500) String reason) {}
