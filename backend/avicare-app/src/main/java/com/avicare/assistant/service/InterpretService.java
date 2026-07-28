package com.avicare.assistant.service;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.assistant.llm.LlmClient;
import com.avicare.assistant.llm.ToolCall;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.domain.UnitStatus;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Turns free text into a confirmable draft: LLM extracts the intent, then this service validates it
 * against the real domain (dry-run via facades) and returns a draft or a clarification. It NEVER
 * writes — execution stays the mobile "Confirmer" tap → the existing field endpoints (offline
 * queue). This is the "AI proposes, the system guarantees" boundary (doc 12 §4).
 *
 * <p>Phase 2 covers the MORTALITY action; the structure (action switch + per-action dry-run) is
 * ready for daily-record / weighing / egg-collection.
 */
@Service
@RequiredArgsConstructor
public class InterpretService {

  private static final List<String> ACTIONS = List.of("MORTALITY");

  private final LlmClient llm;
  private final LivestockFacade livestock;

  public InterpretResponse interpret(Long farmId, String text, Long unitId) {
    var call = llm.interpret(text, ACTIONS);
    if (call.isEmpty()) {
      return InterpretResponse.clarification(
          "Je n'ai pas compris. Dites par exemple : « dix sont morts ».");
    }
    ToolCall tc = call.get();
    if ("MORTALITY".equals(tc.action())) {
      return dryRunMortality(farmId, unitId, tc);
    }
    return InterpretResponse.clarification("Action non prise en charge pour le moment.");
  }

  private InterpretResponse dryRunMortality(Long farmId, Long unitId, ToolCall tc) {
    int count = asInt(tc.args().get("count"));
    if (count < 1) {
      return InterpretResponse.clarification("Combien de sujets ?");
    }

    List<ProductionUnitInfo> active =
        livestock.listFarmUnits(farmId).stream()
            .filter(u -> u.status() == UnitStatus.ACTIVE)
            .toList();

    ProductionUnitInfo unit = resolveUnit(active, unitId);
    if (unit == null) {
      return InterpretResponse.clarification(
          active.size() > 1 ? "Sur quel lot ?" : "Aucun lot actif trouvé.");
    }

    int after = Math.max(0, unit.currentCount() - count);
    String reason = asString(tc.args().get("reason"));

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("count", count);
    fields.put("unitId", unit.id());
    fields.put("unitName", unit.name());
    fields.put("countAfter", after);
    if (reason != null) {
      fields.put("reason", reason);
    }

    String summary =
        "Mortalité de "
            + count
            + " sujets sur le lot "
            + unit.name()
            + ". Effectif après : "
            + after
            + ".";
    return InterpretResponse.draft("MORTALITY", unit.id(), fields, summary);
  }

  private static ProductionUnitInfo resolveUnit(List<ProductionUnitInfo> active, Long unitId) {
    if (unitId != null) {
      return active.stream().filter(u -> u.id().equals(unitId)).findFirst().orElse(null);
    }
    return active.size() == 1 ? active.get(0) : null;
  }

  private static int asInt(Object v) {
    if (v instanceof Number n) return n.intValue();
    try {
      return v == null ? 0 : Integer.parseInt(v.toString());
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private static String asString(Object v) {
    if (v == null) return null;
    String s = v.toString().trim();
    return s.isEmpty() ? null : s;
  }
}
