package com.avicare.assistant.service;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.assistant.llm.LlmClient;
import com.avicare.assistant.llm.LlmMessage;
import com.avicare.assistant.llm.LlmTurn;
import com.avicare.assistant.llm.ToolCall;
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
 * Turns free text into either a confirmable draft (WRITE) or a read-only answer (READ), gated by
 * the caller's permissions. Two paths, both structurally RBAC-scoped (doc 12 §8):
 *
 * <ul>
 *   <li><b>WRITE — single-shot, unchanged.</b> The caller's write tools are offered; the model
 *       picks at most one, the tool validates the args against the domain (dry-run) and returns a
 *       DRAFT or a CLARIFICATION. This service NEVER writes: the write is the mobile "Confirmer"
 *       tap.
 *   <li><b>READ — bounded agentic loop.</b> Only when no write tool matched: the caller's read-only
 *       tools are offered to the model, which loops (tool_use → we execute the read → tool_result →
 *       …, capped) and finally answers in text → ANSWER. The loop is offered read tools only, so it
 *       is structurally unable to mutate anything.
 * </ul>
 *
 * "The AI proposes, the system guarantees."
 */
@Service
@RequiredArgsConstructor
public class InterpretService {

  /** Hard cap on read tool round-trips, so a confused model can never loop forever. */
  private static final int MAX_READ_STEPS = 4;

  private final LlmClient llm;
  private final ToolRegistry registry;
  private final ReadToolRegistry readRegistry;
  private final FarmAccessChecker access;

  public InterpretResponse interpret(Long farmId, String text, Long unitId) {
    // ── WRITE path (single-shot) ────────────────────────────────────────────
    List<AssistantTool> writeTools =
        registry.all().stream()
            .filter(tool -> access.hasPermission(farmId, tool.requiredPermission()))
            .toList();
    if (!writeTools.isEmpty()) {
      List<ToolSpec> specs = writeTools.stream().map(AssistantTool::spec).toList();
      Optional<ToolCall> call = llm.interpret(text, specs);
      if (call.isPresent()) {
        ToolCall tc = call.get();
        return writeTools.stream()
            .filter(tool -> tool.spec().name().equals(tc.action()))
            .findFirst()
            .map(tool -> tool.dryRun(farmId, tc.args(), unitId))
            .orElse(InterpretResponse.clarification("Action non prise en charge pour le moment."));
      }
    }

    // ── READ path (agentic loop) — only when no write action matched ─────────
    List<ReadTool> readTools =
        readRegistry.all().stream()
            .filter(tool -> access.hasPermission(farmId, tool.requiredPermission()))
            .toList();
    if (!readTools.isEmpty()) {
      InterpretResponse answered = runReadLoop(farmId, text, unitId, readTools);
      if (answered != null) {
        return answered;
      }
    }

    if (writeTools.isEmpty() && readTools.isEmpty()) {
      return InterpretResponse.clarification(
          "Aucune action n'est disponible pour votre profil sur cette ferme.");
    }
    return InterpretResponse.clarification(
        "Je n'ai pas compris. Dites par exemple : « dix sont morts » ou « quel est mon stock ? ».");
  }

  /**
   * The bounded READ loop: offer the read specs, run any tool the model invokes, feed results back,
   * until it answers in text (→ ANSWER) or the cap is hit. Returns {@code null} when the model
   * produced no usable answer, so the caller falls back to a clarification.
   */
  private InterpretResponse runReadLoop(
      Long farmId, String text, Long unitId, List<ReadTool> readTools) {
    List<ToolSpec> specs = readTools.stream().map(ReadTool::spec).toList();
    List<LlmMessage> history = new ArrayList<>();
    history.add(LlmMessage.user(text));

    for (int step = 0; step < MAX_READ_STEPS; step++) {
      LlmTurn turn = llm.converse(history, specs);
      if (!turn.hasToolCalls()) {
        String answer = turn.text();
        return (answer == null || answer.isBlank()) ? null : InterpretResponse.answer(answer);
      }
      history.add(LlmMessage.assistant(turn.text(), turn.toolCalls()));

      List<ToolResult> results = new ArrayList<>();
      for (ToolInvocation call : turn.toolCalls()) {
        results.add(new ToolResult(call.id(), runOne(farmId, unitId, readTools, call)));
      }
      history.add(LlmMessage.toolResults(results));
    }
    return null;
  }

  /** Execute one read tool the model invoked, re-checking permission; never mutates. */
  private String runOne(Long farmId, Long unitId, List<ReadTool> readTools, ToolInvocation call) {
    return readTools.stream()
        .filter(tool -> tool.spec().name().equals(call.name()))
        .filter(tool -> access.hasPermission(farmId, tool.requiredPermission()))
        .findFirst()
        .map(tool -> tool.read(farmId, call.args(), unitId))
        .orElse("Consultation non disponible.");
  }
}
