package com.avicare.assistant.llm;

import java.util.List;
import java.util.Optional;

/**
 * Intent-extraction seam. An implementation turns free field text into a {@link ToolCall} among the
 * available actions, or empty when it can't tell (→ the assistant asks a clarifying question).
 *
 * <p>Phase 2 ships {@link MockLlmClient} (deterministic, no key) so the whole chain — controller →
 * dry-run → draft — is testable and demoable without a cloud call. The real Anthropic-backed client
 * is added last, behind this same interface.
 */
public interface LlmClient {

  Optional<ToolCall> interpret(String text, List<String> availableActions);
}
