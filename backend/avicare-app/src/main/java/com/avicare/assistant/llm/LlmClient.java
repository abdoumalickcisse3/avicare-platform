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

  /**
   * Write single-shot: turn free text into at most one {@link ToolCall} among the offered (write)
   * tools, or empty when it can't tell. Used to prepare a confirmable draft — no agentic loop.
   */
  Optional<ToolCall> interpret(String text, List<ToolSpec> tools);

  /**
   * One turn of the agentic READ loop: given the conversation so far and the offered (read-only)
   * tools, the model either invokes tools (to be executed and fed back) or answers in text. The
   * orchestrator ({@code InterpretService}) runs the loop and executes the tools — this seam only
   * does one model round-trip and never touches the domain.
   */
  LlmTurn converse(List<LlmMessage> history, List<ToolSpec> tools);
}
