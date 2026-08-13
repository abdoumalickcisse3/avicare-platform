package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolSpec;
import java.util.Map;

/**
 * One read-only capability the assistant can consult to answer a question: exactly one query,
 * mapped to public read facades, guarded by one {@code resource:read} permission. Unlike a write
 * {@link com.avicare.assistant.tool.AssistantTool} (which only dry-runs and returns a draft to
 * confirm), a read tool EXECUTES for real inside the agentic loop and returns a compact factual
 * result the model phrases into its answer. Because the loop is offered read tools only, it is
 * structurally unable to mutate anything.
 */
public interface ReadTool {

  /** What the model sees and fills. */
  ToolSpec spec();

  /** The {@code resource:read} permission a caller must hold for this tool to be offered/run. */
  String requiredPermission();

  /**
   * Run the query against the read facades and return a short, factual string (no markup) for the
   * model to phrase. Never mutates.
   *
   * @param farmId the current farm
   * @param args the arguments the model extracted (keys match {@link ToolSpec} parameter names)
   * @param contextUnitId the production unit the assistant was opened from, if any
   */
  String read(Long farmId, Map<String, Object> args, Long contextUnitId);
}
