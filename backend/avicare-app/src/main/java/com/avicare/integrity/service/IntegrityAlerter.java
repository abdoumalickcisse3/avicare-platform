package com.avicare.integrity.service;

/**
 * Port for telling the platform's own people about a defect, implemented in the back-office.
 *
 * <p>Same shape as {@code FlagChangeRecorder} in the gating context, and for the same reason: the
 * context that finds the problem should not have to import the one that keeps the audit trail and
 * owns the WhatsApp rail.
 */
public interface IntegrityAlerter {

  /**
   * A sweep has finished.
   *
   * @param criticalOpened how many CRITICAL findings were newly opened — zero means silence, which
   *     is the normal night and must stay unremarkable
   */
  void sweepCompleted(int checksRun, int opened, int resolved, int criticalOpened);

  /** One newly opened CRITICAL finding, told once and only once. */
  void criticalFound(String checkKey, String label, String entityType, Long entityId, Long farmId);

  /** A staff member acted on a finding — recompute, manual fix, or accepted drift. */
  void findingResolved(
      Long findingId, String checkKey, String action, Long actorUserId, String notes);
}
