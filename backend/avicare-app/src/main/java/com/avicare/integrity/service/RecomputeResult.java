package com.avicare.integrity.service;

/**
 * What a recompute would do, or did.
 *
 * @param applied {@code false} for a dry run — the only mode the console offers first
 */
public record RecomputeResult(
    String entityType, Long entityId, String before, String after, String delta, boolean applied) {

  public boolean changesSomething() {
    return before != null && !before.equals(after);
  }
}
