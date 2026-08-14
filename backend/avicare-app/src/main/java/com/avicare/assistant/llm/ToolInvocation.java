package com.avicare.assistant.llm;

import java.util.Map;

/**
 * One tool the model invoked during a loop turn: the provider-assigned {@code id} (needed to match
 * the tool result back), the tool {@code name} and the extracted {@code args}. The {@code id} is
 * echoed on the following tool-result turn.
 */
public record ToolInvocation(String id, String name, Map<String, Object> args) {}
