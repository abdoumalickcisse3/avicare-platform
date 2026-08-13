package com.avicare.assistant.service;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.assistant.llm.LlmClient;
import com.avicare.assistant.llm.ToolCall;
import com.avicare.assistant.tool.AssistantTool;
import com.avicare.assistant.tool.ToolRegistry;
import com.avicare.assistant.tool.ToolSpec;
import com.avicare.common.security.access.FarmAccessChecker;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Turns free text into a confirmable draft, gated by the caller's permissions. The tool set offered
 * to the model is filtered to the tools whose {@code requiredPermission} the caller holds on the
 * farm — so a role can never even name an action it isn't allowed to do (structural gating, doc 12
 * §8). The chosen tool then validates the model's arguments against the real domain (dry-run) and
 * returns a draft or a clarification. This service NEVER writes: the write is the mobile
 * "Confirmer" tap → the existing field endpoints (offline queue). "The AI proposes, the system
 * guarantees."
 */
@Service
@RequiredArgsConstructor
public class InterpretService {

  private final LlmClient llm;
  private final ToolRegistry registry;
  private final FarmAccessChecker access;

  public InterpretResponse interpret(Long farmId, String text, Long unitId) {
    List<AssistantTool> permitted =
        registry.all().stream()
            .filter(tool -> access.hasPermission(farmId, tool.requiredPermission()))
            .toList();
    if (permitted.isEmpty()) {
      return InterpretResponse.clarification(
          "Aucune action n'est disponible pour votre profil sur cette ferme.");
    }

    List<ToolSpec> specs = permitted.stream().map(AssistantTool::spec).toList();
    Optional<ToolCall> call = llm.interpret(text, specs);
    if (call.isEmpty()) {
      return InterpretResponse.clarification(
          "Je n'ai pas compris. Dites par exemple : « dix sont morts ».");
    }

    ToolCall tc = call.get();
    return permitted.stream()
        .filter(tool -> tool.spec().name().equals(tc.action()))
        .findFirst()
        .map(tool -> tool.dryRun(farmId, tc.args(), unitId))
        .orElse(InterpretResponse.clarification("Action non prise en charge pour le moment."));
  }
}
