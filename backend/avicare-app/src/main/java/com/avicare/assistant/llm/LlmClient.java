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
 * <p>{@link MockLlmClient} is the deterministic, keyless default (CI/dev/tests). The real {@link
 * AnthropicLlmClient} is {@code @Primary} when {@code anthropic.api-key} is set.
 */
public interface LlmClient {

  /** One turn of the unified agentic loop over the offered tools. */
  LlmTurn converse(List<LlmMessage> history, List<ToolSpec> tools);
}
