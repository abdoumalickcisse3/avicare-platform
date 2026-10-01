package com.avicare.notification.push;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The phone leaving: the token to retire (at logout). */
public record RevokePushDeviceRequest(@NotBlank @Size(max = 200) String token) {}
