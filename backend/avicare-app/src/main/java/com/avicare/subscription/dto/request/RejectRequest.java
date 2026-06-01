package com.avicare.subscription.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Reject a change request with a reason. */
public record RejectRequest(@NotBlank @Size(max = 2000) String reason) {}
