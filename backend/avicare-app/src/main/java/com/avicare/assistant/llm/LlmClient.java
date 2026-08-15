package com.avicare.assistant.llm;

import com.avicare.assistant.tool.ToolSpec;
import java.util.List;

/**
 * The single model seam of the assistant. One unified agentic loop turns free field text into
 * either a confirmable write draft or a read-only answer: given the conversation so far and the
 * offered tools (write + read, filtered by the caller's permissions), the model either invokes
 * tools or answers in text. {@code InterpretService} runs the loop — it dry-runs a write tool the
 * model picked (→ a DRAFT), executes a read tool and feeds the result back (→ continue), or returns
 * the model's text (→ an ANSWER). This seam only does one model round-trip and never touches the
 * domain.
 *
 * <p>The client is a pure transport: the caller supplies the {@code system} prompt (persona), so
 * the terse field-capture flow and the conversational advisor flow share one seam and one loop.
 *
 * <p>{@link MockLlmClient} is the deterministic, keyless default (CI/dev/tests). The real {@link
 * AnthropicLlmClient} is {@code @Primary} when {@code anthropic.enabled=true}.
 */
public interface LlmClient {

  /**
   * One turn of the unified agentic loop, under the given system prompt, over the offered tools.
   */
  LlmTurn converse(String system, List<LlmMessage> history, List<ToolSpec> tools);
}
