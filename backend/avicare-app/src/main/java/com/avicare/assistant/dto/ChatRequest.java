package com.avicare.assistant.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * A conversational advisor request: the whole thread so far ({@code messages}, oldest first, ending
 * with the user's latest turn) and an optional {@code unitId} to scope the answer to one production
 * unit. The reply reuses {@link InterpretResponse} — an ANSWER (advice), a DRAFT to confirm, or a
 * CLARIFICATION.
 */
public record ChatRequest(@NotEmpty List<ChatTurn> messages, Long unitId) {}
