package com.avicare.admin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * A WhatsApp campaign.
 *
 * <p>{@code farmIds} empty means every active farm. Spelling that out rather than offering a
 * separate "send to all" flag keeps one code path, so the recipient count shown and the recipients
 * reached are computed the same way.
 */
public record BroadcastRequest(@NotBlank @Size(max = 1000) String message, List<Long> farmIds) {}
