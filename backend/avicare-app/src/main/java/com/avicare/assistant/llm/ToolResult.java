package com.avicare.assistant.llm;

/**
 * The result of executing a READ tool, fed back to the model on the next turn. {@code toolUseId}
 * matches the {@link ToolInvocation#id()} that produced it; {@code content} is a compact, factual
 * string the model phrases into its answer (never HTML/markup).
 */
public record ToolResult(String toolUseId, String content) {}
