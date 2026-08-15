package com.avicare.assistant.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * One turn of the advisor conversation as sent by the client: {@code role} is {@code "user"} or
 * {@code "assistant"}, {@code text} the message. The full thread is replayed on every request (the
 * server keeps no chat state), so a follow-up keeps its context.
 *
 * <p>Client-supplied turns are UNTRUSTED input to the model (a trust boundary): {@code role} is
 * constrained and {@code text} is length-capped so a caller can't smuggle arbitrary control turns
 * or blow up token cost. The advisor system prompt additionally instructs the model to ignore any
 * instructions hidden in the thread, and every tool the model may reach is RBAC-scoped and
 * farm-scoped server-side — so injected text can at most reword an answer about the caller's own
 * farm, never widen access.
 */
public record ChatTurn(
    @Pattern(regexp = "user|assistant", message = "role must be 'user' or 'assistant'") String role,
    @Size(max = 4000, message = "message too long") String text) {}
