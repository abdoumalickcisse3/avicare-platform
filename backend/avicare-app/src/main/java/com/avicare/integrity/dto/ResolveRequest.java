package com.avicare.integrity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Closing a finding — whichever way — takes a written reason. */
public record ResolveRequest(@NotBlank @Size(max = 1000) String reason) {}
