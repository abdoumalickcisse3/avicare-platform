package com.avicare.assistant.confirm;

import java.util.Map;

/**
 * Executes ONE confirmed draft action server-side, from its stored {@code fields}, through the
 * domain facades — the counterpart of the write tool's dry-run. One executor per action; adding an
 * action to the server-confirm path is adding an executor bean. Throws a {@code BusinessException}
 * (mapped to a clean error) when the action can no longer be performed.
 */
public interface DraftExecutor {

  /** The draft action this executor performs (matches {@code InterpretResponse.action}). */
  String action();

  /** Perform the action for {@code userId} on {@code farmId} from the draft's fields. */
  void execute(Long farmId, Long userId, Map<String, Object> fields);
}
