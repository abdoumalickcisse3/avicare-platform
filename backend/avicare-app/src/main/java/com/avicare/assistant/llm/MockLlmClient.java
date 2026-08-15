package com.avicare.assistant.llm;

import com.avicare.assistant.tool.ToolSpec;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Deterministic, keyless {@link LlmClient} used whenever no Anthropic key is configured (CI, dev,
 * DB-less tests). It keyword-matches the phrase to one offered tool — a WRITE tool (with a few
 * extracted args) that {@code InterpretService} dry-runs into a draft, or a READ tool that it
 * executes and feeds back before the mock phrases the result as the answer. Intentionally dumb: the
 * real value comes from {@link AnthropicLlmClient}; this proves the unified-loop plumbing and keeps
 * every downstream test green without a key.
 *
 * <p>Default bean; the Anthropic client becomes {@code @Primary} when the key is present.
 */
@Component
public class MockLlmClient implements LlmClient {

  private static final Pattern MORTALITY = Pattern.compile("mort|deces|décès|perdu|crev|mortalit");
  private static final Pattern COUNT = Pattern.compile("(\\d+)");
  private static final Pattern VACCINE = Pattern.compile("vaccin");
  private static final Pattern OBSERVATION =
      Pattern.compile("observ|sympt|tousse|malade|boite|diarrh|éternu|eternu");
  private static final Pattern NEW_CLIENT =
      Pattern.compile("nouveau client|créer.*client|creer.*client|ajouter.*client");
  private static final Pattern STOCK = Pattern.compile("stock|reste.*(aliment|mais|maïs)|aliment");
  private static final Pattern HEADCOUNT =
      Pattern.compile("effectif|combien.*(poulet|sujet|tête|tete)");
  private static final Pattern PNL =
      Pattern.compile("resultat|résultat|marge|benefice|bénéfice|rentab|p&l|pnl");
  private static final Pattern SALES = Pattern.compile("chiffre|vente|vendu|\\bca\\b");
  private static final Pattern OUTSTANDING =
      Pattern.compile("doit|dette|encours|creance|créance|debiteur|débiteur");
  private static final Pattern EGGS = Pattern.compile("œuf|oeuf|ponte|pondu|pondus");
  private static final Pattern GROWTH = Pattern.compile("gmq|croissance|gain|poids moyen");
  private static final Pattern OVERDUE = Pattern.compile("retard|impayé|impaye|en retard");
  private static final Pattern LOW_STOCK = Pattern.compile("stock bas|seuil|manque|rupture");
  private static final Pattern FEED = Pattern.compile("consomm|nourriture|mange");
  private static final Pattern VACC_DUE =
      Pattern.compile(
          "vaccination.*(due|dues|retard|prevu)|quelle.*vaccin|vaccin.*(due|dues|retard)");

  /**
   * One turn of the unified loop: on a fresh question keyword-match a WRITE tool (with args) or a
   * READ tool; once a TOOL result is in the history, phrase it as the final answer.
   */
  @Override
  public LlmTurn converse(String system, List<LlmMessage> history, List<ToolSpec> tools) {
    if (history.isEmpty()) {
      return LlmTurn.answer("");
    }
    LlmMessage last = history.get(history.size() - 1);
    if (last.role() == LlmMessage.Role.TOOL) {
      return LlmTurn.answer(
          last.toolResults().stream().map(ToolResult::content).collect(Collectors.joining(" ")));
    }

    String text = lastUserText(history);
    String q = text.toLowerCase();

    // WRITE intents — InterpretService dry-runs these into a draft (terminal).
    if (offered(tools, "MORTALITY") && MORTALITY.matcher(q).find()) {
      Matcher m = COUNT.matcher(q);
      if (m.find()) {
        return call("MORTALITY", Map.of("count", Integer.parseInt(m.group(1))));
      }
    }
    if (offered(tools, "VACCINATION") && VACCINE.matcher(q).find()) {
      return call("VACCINATION", Map.of("vaccine", text));
    }
    if (offered(tools, "HEALTH_OBSERVATION") && OBSERVATION.matcher(q).find()) {
      return call("HEALTH_OBSERVATION", Map.of("observation", text));
    }
    if (offered(tools, "CREATE_CLIENT") && NEW_CLIENT.matcher(q).find()) {
      return call("CREATE_CLIENT", Map.of("name", text));
    }

    // READ intents — InterpretService executes these and feeds the result back.
    String readTool = readTool(tools, q);
    return readTool != null ? call(readTool, Map.of()) : LlmTurn.answer("");
  }

  /** The first offered read tool whose keyword the question matches, or null. */
  private static String readTool(List<ToolSpec> tools, String q) {
    if (offered(tools, "MORTALITY_QUERY") && MORTALITY.matcher(q).find()) {
      return "MORTALITY_QUERY";
    }
    if (offered(tools, "LOW_STOCK") && LOW_STOCK.matcher(q).find()) {
      return "LOW_STOCK";
    }
    if (offered(tools, "FEED_CONSUMPTION") && FEED.matcher(q).find()) {
      return "FEED_CONSUMPTION";
    }
    if (offered(tools, "STOCK_QUERY") && STOCK.matcher(q).find()) {
      return "STOCK_QUERY";
    }
    if (offered(tools, "FLOCK_HEADCOUNT") && HEADCOUNT.matcher(q).find()) {
      return "FLOCK_HEADCOUNT";
    }
    if (offered(tools, "CLIENT_OUTSTANDING") && OUTSTANDING.matcher(q).find()) {
      return "CLIENT_OUTSTANDING";
    }
    if (offered(tools, "FARM_PNL") && PNL.matcher(q).find()) {
      return "FARM_PNL";
    }
    if (offered(tools, "SALES_SUMMARY") && SALES.matcher(q).find()) {
      return "SALES_SUMMARY";
    }
    if (offered(tools, "OVERDUE_INVOICES") && OVERDUE.matcher(q).find()) {
      return "OVERDUE_INVOICES";
    }
    if (offered(tools, "EGG_PRODUCTION_QUERY") && EGGS.matcher(q).find()) {
      return "EGG_PRODUCTION_QUERY";
    }
    if (offered(tools, "GROWTH_QUERY") && GROWTH.matcher(q).find()) {
      return "GROWTH_QUERY";
    }
    if (offered(tools, "VACCINATION_DUE") && VACC_DUE.matcher(q).find()) {
      return "VACCINATION_DUE";
    }
    return null;
  }

  private static LlmTurn call(String name, Map<String, Object> args) {
    return LlmTurn.calls(List.of(new ToolInvocation("mock-1", name, args)), null);
  }

  private static boolean offered(List<ToolSpec> tools, String name) {
    return tools.stream().anyMatch(t -> name.equals(t.name()));
  }

  /** The current question is the LAST user turn (short-term memory prepends earlier ones). */
  private static String lastUserText(List<LlmMessage> history) {
    for (int i = history.size() - 1; i >= 0; i--) {
      LlmMessage m = history.get(i);
      if (m.role() == LlmMessage.Role.USER) {
        return m.text() == null ? "" : m.text();
      }
    }
    return "";
  }
}
