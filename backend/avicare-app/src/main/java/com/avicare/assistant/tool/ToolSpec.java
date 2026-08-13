package com.avicare.assistant.tool;

import java.util.List;

/**
 * The LLM-facing description of a tool: what the model sees and fills. This is deliberately free of
 * any permission or facade concern — {@code InterpretService} decides which specs to expose, and
 * {@link com.avicare.assistant.llm.LlmClient} turns a spec into a provider tool schema.
 */
public record ToolSpec(String name, String description, List<ToolParam> parameters) {}
