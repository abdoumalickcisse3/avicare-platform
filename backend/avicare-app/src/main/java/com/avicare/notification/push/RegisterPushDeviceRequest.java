package com.avicare.notification.push;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** The phone announcing itself: its Expo push token and its operating system. */
public record RegisterPushDeviceRequest(
    @NotBlank
        @Size(max = 200)
        @Pattern(
            regexp = "^(Expo|Exponent)PushToken\\[[^\\]\\s]+]$",
            message = "must be an Expo push token")
        String token,
    @NotNull PushPlatform platform) {}
