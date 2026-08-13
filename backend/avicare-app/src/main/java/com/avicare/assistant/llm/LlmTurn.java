package com.avicare.assistant.llm;

import java.util.List;

/**
 * The model's output for one agentic READ turn: the tools it wants run ({@code toolCalls}) and/or
 * its {@code text}. When {@code toolCalls} is empty the {@code text} is the final answer; otherwise
 * the orchestrator executes the tools and continues the loop.
 */
public record LlmTurn(List<ToolInvocation> toolCalls, String text) {

  public boolean hasToolCalls() {
    return toolCalls != null && !toolCalls.isEmpty();
  }

  public static LlmTurn answer(String text) {
    return new LlmTurn(List.of(), text);
  }

  public static LlmTurn calls(List<ToolInvocation> toolCalls, String text) {
    return new LlmTurn(toolCalls, text);
  }
}
