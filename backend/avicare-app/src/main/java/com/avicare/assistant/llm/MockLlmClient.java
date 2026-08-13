package com.avicare.assistant.llm;

import com.avicare.assistant.tool.ToolSpec;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
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
  private static final Pattern STOCK = Pattern.compile("stock|reste.*(aliment|mais|maïs)|aliment");
  private static final Pattern HEADCOUNT =
      Pattern.compile("effectif|combien.*(poulet|sujet|tête|tete)");
  private static final Pattern PNL =
      Pattern.compile("resultat|résultat|marge|benefice|bénéfice|rentab|p&l|pnl");
  private static final Pattern SALES = Pattern.compile("chiffre|vente|vendu|\\bca\\b");
  private static final Pattern OUTSTANDING =
      Pattern.compile("doit|dette|encours|creance|créance|debiteur|débiteur");

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

  /**
   * Deterministic READ loop: on the first (USER) turn, keyword-match the question to one offered
   * read tool and invoke it; once a TOOL result is in the history, phrase it as the final answer.
   * Intentionally dumb — it proves the loop plumbing without a key.
   */
  @Override
  public LlmTurn converse(List<LlmMessage> history, List<ToolSpec> tools) {
    if (history.isEmpty()) {
      return LlmTurn.answer("");
    }
    LlmMessage last = history.get(history.size() - 1);
    if (last.role() == LlmMessage.Role.TOOL) {
      String answer =
          last.toolResults().stream().map(ToolResult::content).collect(Collectors.joining(" "));
      return LlmTurn.answer(answer);
    }
    // First turn: pick a read tool by keyword among those offered.
    String question = firstUserText(history).toLowerCase();
    String tool = null;
    if (offered(tools, "MORTALITY_QUERY") && MORTALITY.matcher(question).find()) {
      tool = "MORTALITY_QUERY";
    } else if (offered(tools, "STOCK_QUERY") && STOCK.matcher(question).find()) {
      tool = "STOCK_QUERY";
    } else if (offered(tools, "FLOCK_HEADCOUNT") && HEADCOUNT.matcher(question).find()) {
      tool = "FLOCK_HEADCOUNT";
    } else if (offered(tools, "CLIENT_OUTSTANDING") && OUTSTANDING.matcher(question).find()) {
      tool = "CLIENT_OUTSTANDING";
    } else if (offered(tools, "FARM_PNL") && PNL.matcher(question).find()) {
      tool = "FARM_PNL";
    } else if (offered(tools, "SALES_SUMMARY") && SALES.matcher(question).find()) {
      tool = "SALES_SUMMARY";
    }
    if (tool == null) {
      return LlmTurn.answer("");
    }
    return LlmTurn.calls(List.of(new ToolInvocation("mock-1", tool, Map.of())), null);
  }

  private static boolean offered(List<ToolSpec> tools, String name) {
    return tools.stream().anyMatch(t -> name.equals(t.name()));
  }

  private static String firstUserText(List<LlmMessage> history) {
    return history.stream()
        .filter(m -> m.role() == LlmMessage.Role.USER)
        .map(LlmMessage::text)
        .findFirst()
        .orElse("");
  }
}
