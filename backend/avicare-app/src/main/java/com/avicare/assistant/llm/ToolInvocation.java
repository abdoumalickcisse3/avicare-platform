package com.avicare.assistant.llm;

import java.util.Map;

/**
 * One tool the model invoked during an agentic READ turn: the provider-assigned {@code id} (needed
 * to match the tool result back), the tool {@code name} and the extracted {@code args}. Distinct
 * from {@link ToolCall} (the write single-shot) because the loop must echo the {@code id} on the
 * following tool-result turn.
 */
public record ToolInvocation(String id, String name, Map<String, Object> args) {}
