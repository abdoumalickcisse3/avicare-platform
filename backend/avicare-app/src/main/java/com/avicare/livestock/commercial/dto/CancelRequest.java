package com.avicare.livestock.commercial.dto;

import jakarta.validation.constraints.Size;

/** Cancel a commercial document (order, sale, delivery, invoice) with an optional reason (B5-5). */
public record CancelRequest(@Size(max = 500) String reason) {}
