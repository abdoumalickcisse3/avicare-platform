package com.avicare.assistant.llm;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Deterministic, keyless {@link LlmClient} used until the real Anthropic client is wired (Phase 2,
 * Task 6). It recognises the mortality intent by keyword + a digit count — enough to exercise the
 * full interpret → dry-run → draft chain in tests and dev. It intentionally stays dumb (no spelled
 * numbers, no other actions): the real value comes from the LLM; this only proves the plumbing.
 *
 * <p>Default bean today (only implementation). When {@code AnthropicLlmClient} lands it becomes
 * {@code @Primary}/conditional and this stays the test/dev fallback.
 */
@Component
public class MockLlmClient implements LlmClient {

  private static final Pattern MORTALITY = Pattern.compile("mort|deces|décès|perdu|crev|mortalit");
  private static final Pattern COUNT = Pattern.compile("(\\d+)");

  @Override
  public Optional<ToolCall> interpret(String text, List<String> availableActions) {
    if (text == null) return Optional.empty();
    String lower = text.toLowerCase();
    if (availableActions.contains("MORTALITY") && MORTALITY.matcher(lower).find()) {
      Matcher m = COUNT.matcher(lower);
      if (m.find()) {
        int count = Integer.parseInt(m.group(1));
        return Optional.of(new ToolCall("MORTALITY", Map.of("count", count)));
      }
    }
    return Optional.empty();
  }
}
