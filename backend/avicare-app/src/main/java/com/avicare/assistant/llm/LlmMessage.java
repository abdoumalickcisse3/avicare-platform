package com.avicare.assistant.llm;

import java.util.List;

/**
 * One neutral turn of an agentic READ conversation, kept SDK-free so the tool/facade layer never
 * depends on a provider. The history alternates: a {@code USER} question, an {@code ASSISTANT} turn
 * (its {@code text} and/or the {@code toolCalls} it invoked), then a {@code TOOL} turn carrying the
 * {@code toolResults}. {@link LlmClient#converse} rebuilds provider messages from this list.
 */
public record LlmMessage(
    Role role, String text, List<ToolInvocation> toolCalls, List<ToolResult> toolResults) {

  public enum Role {
    USER,
    ASSISTANT,
    TOOL
  }

  public static LlmMessage user(String text) {
    return new LlmMessage(Role.USER, text, List.of(), List.of());
  }

  public static LlmMessage assistant(String text, List<ToolInvocation> toolCalls) {
    return new LlmMessage(Role.ASSISTANT, text, toolCalls, List.of());
  }

  public static LlmMessage toolResults(List<ToolResult> toolResults) {
    return new LlmMessage(Role.TOOL, null, List.of(), toolResults);
  }
}
