package com.avicare.assistant.service;

import com.avicare.assistant.audit.AssistantMemory;
import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.assistant.llm.LlmClient;
import com.avicare.assistant.llm.LlmMessage;
import com.avicare.assistant.llm.LlmTurn;
import com.avicare.assistant.llm.ToolInvocation;
import com.avicare.assistant.llm.ToolResult;
import com.avicare.assistant.read.ReadTool;
import com.avicare.assistant.read.ReadToolRegistry;
import com.avicare.assistant.tool.AssistantTool;
import com.avicare.assistant.tool.ToolRegistry;
import com.avicare.assistant.tool.ToolSpec;
import com.avicare.common.security.access.FarmAccessChecker;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Turns free text into either a confirmable draft (WRITE) or a read-only answer (READ) through a
 * single, unified agentic loop, gated by the caller's permissions. One model round-trip handles the
 * common case (dictate an action, or ask a simple question); the loop only continues while the
 * model keeps consulting read tools.
 *
 * <ul>
 *   <li>The caller's WRITE tools (dry-run) and READ tools (execute) are offered together, both
 *       structurally RBAC-scoped — a role can never even name an action it isn't allowed to do (doc
 *       12 §8).
 *   <li>A WRITE tool the model picks is dry-run against the domain and returned as a DRAFT — a
 *       terminal proposal; the loop stops there (the write itself is the mobile "Confirmer" tap).
 *   <li>A READ tool is executed for real (read-only) and its result fed back, so the model can
 *       consult several tools before answering in text → ANSWER. Because a write tool only ever
 *       dry-runs and terminates, the loop can never mutate anything.
 * </ul>
 *
 * "The AI proposes, the system guarantees."
 */
@Service
@RequiredArgsConstructor
public class InterpretService {

  /** Hard cap on model round-trips, so a confused model can never loop forever. */
  private static final int MAX_STEPS = 5;

  private final LlmClient llm;
  private final ToolRegistry registry;
  private final ReadToolRegistry readRegistry;
  private final AssistantMemory memory;
  private final FarmAccessChecker access;

  public InterpretResponse interpret(Long farmId, Long userId, String text, Long unitId) {
    List<AssistantTool> writeTools =
        registry.all().stream()
            .filter(tool -> access.hasPermission(farmId, tool.requiredPermission()))
            .toList();
    List<ReadTool> readTools =
        readRegistry.all().stream()
            .filter(tool -> access.hasPermission(farmId, tool.requiredPermission()))
            .toList();
    if (writeTools.isEmpty() && readTools.isEmpty()) {
      return InterpretResponse.clarification(
          "Aucune action n'est disponible pour votre profil sur cette ferme.");
    }

    List<ToolSpec> specs = new ArrayList<>();
    writeTools.forEach(tool -> specs.add(tool.spec()));
    readTools.forEach(tool -> specs.add(tool.spec()));

    // Short-term memory: prior read answers give a follow-up question its subject.
    List<LlmMessage> history = new ArrayList<>(memory.recentTurns(farmId, userId));
    history.add(LlmMessage.user(text));

    for (int step = 0; step < MAX_STEPS; step++) {
      LlmTurn turn = llm.converse(history, specs);
      if (!turn.hasToolCalls()) {
        String answer = turn.text();
        return (answer == null || answer.isBlank())
            ? InterpretResponse.clarification(
                "Je n'ai pas compris. Dites par exemple : « dix sont morts » ou « quel est mon"
                    + " stock ? ».")
            : InterpretResponse.answer(answer);
      }

      // A WRITE tool the model picked is a terminal proposal: dry-run it → DRAFT, and stop.
      for (ToolInvocation call : turn.toolCalls()) {
        Optional<AssistantTool> writeTool =
            writeTools.stream().filter(tool -> tool.spec().name().equals(call.name())).findFirst();
        if (writeTool.isPresent()) {
          return writeTool.get().dryRun(farmId, call.args(), unitId);
        }
      }

      // Otherwise every call is a read: execute them, feed the results back, continue the loop.
      history.add(LlmMessage.assistant(turn.text(), turn.toolCalls()));
      List<ToolResult> results = new ArrayList<>();
      for (ToolInvocation call : turn.toolCalls()) {
        results.add(new ToolResult(call.id(), runRead(farmId, unitId, readTools, call)));
      }
      history.add(LlmMessage.toolResults(results));
    }
    return InterpretResponse.clarification("Je n'ai pas pu répondre. Reformulez, s'il vous plaît.");
  }

  /** Execute one read tool the model invoked, re-checking permission; never mutates. */
  private String runRead(Long farmId, Long unitId, List<ReadTool> readTools, ToolInvocation call) {
    return readTools.stream()
        .filter(tool -> tool.spec().name().equals(call.name()))
        .filter(tool -> access.hasPermission(farmId, tool.requiredPermission()))
        .findFirst()
        .map(tool -> tool.read(farmId, call.args(), unitId))
        .orElse("Consultation non disponible.");
  }
}
