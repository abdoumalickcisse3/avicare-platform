package com.avicare.admin.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Open a support session as a farmer.
 *
 * <p>{@code reason} is optional but goes straight into the audit entry: a support session nobody
 * can reconstruct afterwards is not supervision, it is a back door.
 */
public record ImpersonationRequest(@NotNull Long userId, @Size(max = 500) String reason) {}
