package com.avicare.assistant.service;

import com.avicare.assistant.audit.AssistantMemory;
import com.avicare.assistant.dto.ChatTurn;
import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.assistant.llm.LlmClient;
import com.avicare.assistant.llm.LlmMessage;
import com.avicare.assistant.llm.LlmTurn;
import com.avicare.assistant.llm.Prompts;
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
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
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

  /**
   * One-shot field capture: dictate an action (→ DRAFT) or ask a simple question (→ ANSWER), terse
   * persona, with the user's recent read answers prepended as short-term memory.
   */
  public InterpretResponse interpret(Long farmId, Long userId, String text, Long unitId) {
    Tools tools = toolsFor(farmId);
    if (tools.isEmpty()) {
      return InterpretResponse.clarification(
          "Aucune action n'est disponible pour votre profil sur cette ferme.");
    }
    // Short-term memory: prior read answers give a follow-up question its subject.
    List<LlmMessage> history = new ArrayList<>(memory.recentTurns(farmId, userId));
    history.add(LlmMessage.user(text));
    return loop(farmId, unitId, Prompts.fieldAssistant(), history, tools);
  }

  /**
   * Conversational advisor: the full chat thread drives the same loop under the advisor persona
   * (analyse + advise, grounded in the read tools), scoped to the domains the caller may access. A
   * dictated action still terminates as a DRAFT to confirm.
   */
  public InterpretResponse chat(Long farmId, Long userId, List<ChatTurn> messages, Long unitId) {
    Tools tools = toolsFor(farmId);
    if (tools.isEmpty()) {
      return InterpretResponse.clarification(
          "Aucune donnée n'est disponible pour votre profil sur cette ferme.");
    }
    List<LlmMessage> history = toHistory(messages);
    if (history.isEmpty()) {
      return InterpretResponse.clarification("Posez une question ou dictez une action.");
    }
    return loop(farmId, unitId, Prompts.advisor(farmId, tools.domains()), history, tools);
  }

  /**
   * The shared unified loop: converse, dry-run a write into a DRAFT, or execute reads and continue.
   */
  private InterpretResponse loop(
      Long farmId, Long unitId, String system, List<LlmMessage> history, Tools tools) {
    for (int step = 0; step < MAX_STEPS; step++) {
      LlmTurn turn = llm.converse(system, history, tools.specs());
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
            tools.write().stream().filter(t -> t.spec().name().equals(call.name())).findFirst();
        if (writeTool.isPresent()) {
          return writeTool.get().dryRun(farmId, call.args(), unitId);
        }
      }

      // Otherwise every call is a read: execute them, feed the results back, continue the loop.
      history.add(LlmMessage.assistant(turn.text(), turn.toolCalls()));
      List<ToolResult> results = new ArrayList<>();
      for (ToolInvocation call : turn.toolCalls()) {
        results.add(new ToolResult(call.id(), runRead(farmId, unitId, tools.read(), call)));
      }
      history.add(LlmMessage.toolResults(results));
    }
    return InterpretResponse.clarification("Je n'ai pas pu répondre. Reformulez, s'il vous plaît.");
  }

  /** The write + read tools the caller may use on this farm, plus their combined specs. */
  private Tools toolsFor(Long farmId) {
    List<AssistantTool> write =
        registry.all().stream()
            .filter(tool -> access.hasPermission(farmId, tool.requiredPermission()))
            .toList();
    List<ReadTool> read =
        readRegistry.all().stream()
            .filter(tool -> access.hasPermission(farmId, tool.requiredPermission()))
            .toList();
    List<ToolSpec> specs = new ArrayList<>();
    write.forEach(tool -> specs.add(tool.spec()));
    read.forEach(tool -> specs.add(tool.spec()));
    return new Tools(write, read, specs);
  }

  /** Map the client's chat thread to neutral history turns, dropping blanks. */
  private static List<LlmMessage> toHistory(List<ChatTurn> messages) {
    List<LlmMessage> history = new ArrayList<>();
    for (ChatTurn turn : messages) {
      if (turn == null || turn.text() == null || turn.text().isBlank()) {
        continue;
      }
      history.add(
          "assistant".equalsIgnoreCase(turn.role())
              ? LlmMessage.assistant(turn.text(), List.of())
              : LlmMessage.user(turn.text()));
    }
    return history;
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

  /**
   * The permission-scoped tool set for one farm, with the data domains it grants (for the prompt).
   */
  private record Tools(List<AssistantTool> write, List<ReadTool> read, List<ToolSpec> specs) {

    private static final Map<String, String> DOMAIN_FR =
        Map.of(
            "poultry", "élevage volaille",
            "livestock", "élevage",
            "inventory", "stock et intrants",
            "commercial", "commercial et ventes",
            "finance", "finances",
            "health", "santé animale");

    boolean isEmpty() {
      return write.isEmpty() && read.isEmpty();
    }

    /** French domain labels (deduplicated, sorted) derived from the granted tools' permissions. */
    List<String> domains() {
      return Stream.concat(
              write.stream().map(AssistantTool::requiredPermission),
              read.stream().map(ReadTool::requiredPermission))
          .map(perm -> perm.contains(":") ? perm.substring(0, perm.indexOf(':')) : perm)
          .map(prefix -> DOMAIN_FR.getOrDefault(prefix, prefix))
          .distinct()
          .sorted()
          .toList();
    }
  }
}
