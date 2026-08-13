package com.avicare.assistant.llm;

import com.avicare.assistant.tool.ToolSpec;
import java.util.List;
import java.util.Optional;

/**
 * Intent-extraction seam. An implementation turns free field text into a {@link ToolCall} among the
 * offered tools, or empty when it can't tell (→ the assistant asks a clarifying question). The tool
 * set is chosen per request by {@code InterpretService} (filtered by the caller's permissions), so
 * this layer only ever sees what the user is allowed to do.
 *
 * <p>{@link MockLlmClient} is the deterministic, keyless default (CI/dev/tests). The real {@link
 * AnthropicLlmClient} is {@code @Primary} when {@code anthropic.api-key} is set.
 */
public interface LlmClient {

  Optional<ToolCall> interpret(String text, List<ToolSpec> tools);
}
