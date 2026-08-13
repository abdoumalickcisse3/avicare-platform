package com.avicare.assistant.llm;

import com.avicare.assistant.tool.ToolSpec;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Deterministic, keyless {@link LlmClient} used whenever no Anthropic key is configured (CI, dev,
 * DB-less tests). It recognises the mortality intent by keyword + a digit count — enough to
 * exercise the full interpret → dry-run → draft chain without a cloud call. It stays intentionally
 * dumb (only mortality, only digits): the real value comes from {@link AnthropicLlmClient}; this
 * proves the plumbing and keeps every downstream test green without a key.
 *
 * <p>Default bean; the Anthropic client becomes {@code @Primary} when the key is present.
 */
@Component
public class MockLlmClient implements LlmClient {

  private static final Pattern MORTALITY = Pattern.compile("mort|deces|décès|perdu|crev|mortalit");
  private static final Pattern COUNT = Pattern.compile("(\\d+)");

  @Override
  public Optional<ToolCall> interpret(String text, List<ToolSpec> tools) {
    if (text == null) {
      return Optional.empty();
    }
    boolean mortalityOffered = tools.stream().anyMatch(t -> "MORTALITY".equals(t.name()));
    String lower = text.toLowerCase();
    if (mortalityOffered && MORTALITY.matcher(lower).find()) {
      Matcher m = COUNT.matcher(lower);
      if (m.find()) {
        int count = Integer.parseInt(m.group(1));
        return Optional.of(new ToolCall("MORTALITY", Map.of("count", count)));
      }
    }
    return Optional.empty();
  }
}
