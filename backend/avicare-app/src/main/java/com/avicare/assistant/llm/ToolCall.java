package com.avicare.assistant.llm;

import java.util.Map;

/**
 * A structured action the LLM (or the mock) decided to invoke: the action name and its extracted
 * arguments. The assistant NEVER executes this directly — {@code InterpretService} validates it
 * (dry-run) and returns a draft the human confirms.
 */
public record ToolCall(String action, Map<String, Object> args) {}
