package com.avicare.assistant.dto;

/**
 * One turn of the advisor conversation as sent by the client: {@code role} is {@code "user"} or
 * {@code "assistant"}, {@code text} the message. The full thread is replayed on every request (the
 * server keeps no chat state), so a follow-up keeps its context.
 */
public record ChatTurn(String role, String text) {}
