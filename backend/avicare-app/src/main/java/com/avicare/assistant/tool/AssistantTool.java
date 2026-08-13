package com.avicare.assistant.tool;

import com.avicare.assistant.dto.InterpretResponse;
import java.util.Map;

/**
 * One capability the assistant can prepare: exactly one app action, mapped to one existing
 * endpoint, guarded by one permission. This is the unit that makes "the AI can do anything the user
 * can do" true and safe — the tool set offered to the model is filtered to the tools whose {@link
 * #requiredPermission()} the caller holds, so a role can never invoke an action it isn't allowed to
 * (structural gating, not prompt-based).
 *
 * <p>A tool NEVER writes. {@link #dryRun} validates the model's extracted arguments against the
 * real domain (via public facades) and returns a confirmable DRAFT — with the real consequence — or
 * a CLARIFICATION question. The actual write happens later, on the human's "Confirmer" tap, through
 * the existing field endpoints (doc 12 §4).
 */
public interface AssistantTool {

  /** What the model sees and fills. */
  ToolSpec spec();

  /**
   * The {@code resource:verb} permission a caller must hold for this tool to be offered/executed.
   */
  String requiredPermission();

  /**
   * Validate the extracted arguments against the domain and build a draft (or a clarification).
   *
   * @param farmId the current farm
   * @param args the arguments the model extracted (keys match {@link ToolSpec} parameter names)
   * @param contextUnitId the production unit the assistant was opened from, if any (helps resolve
   *     the lot when the phrase doesn't name one)
   */
  InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId);
}
