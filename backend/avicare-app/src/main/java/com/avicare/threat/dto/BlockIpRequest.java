package com.avicare.threat.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Blocking or unblocking an address by hand.
 *
 * @param minutes bounded on purpose — a block with no end is how a real farmer behind an operator
 *     NAT gets locked out for good
 */
public record BlockIpRequest(
    @NotBlank @Size(max = 45) String ipAddress,
    @NotBlank @Size(max = 255) String reason,
    @Min(1) @Max(10_080) Integer minutes) {}
