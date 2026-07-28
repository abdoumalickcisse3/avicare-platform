package com.avicare.assistant.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * What the mobile sends to the assistant: the transcribed text and, optionally, the lot the sheet
 * was opened from. Only text — never audio — leaves the device.
 */
public record InterpretRequest(@NotBlank String text, Long unitId) {}
