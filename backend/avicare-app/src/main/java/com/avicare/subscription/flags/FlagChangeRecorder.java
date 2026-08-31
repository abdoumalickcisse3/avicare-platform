package com.avicare.subscription.flags;

/**
 * Port through which a flag change reaches the platform audit trail and, when it matters, the
 * on-call staff.
 *
 * <p>Declared here and implemented in the back-office so the dependency points the right way: the
 * gating context owns the switches, the console context owns the trail. Without it the sweep job —
 * which lifts expired cuts on its own, with no request and no user behind it — would either import
 * the admin context or go unrecorded, and an emergency mechanism whose lapse leaves no trace is one
 * nobody can reconstruct afterwards.
 */
public interface FlagChangeRecorder {

  /**
   * @param action short verb, recorded as {@code flag.<action>} ({@code killswitch}, {@code
   *     killswitch.extend}, {@code killswitch.lift}, {@code killswitch.expire}, {@code
   *     global.enable}, {@code global.disable})
   * @param actorUserId the staff member behind it, or {@code null} for the sweep job
   * @param urgent whether staff should also be told out of band — a cut and its lapse both change
   *     what the platform is serving, and neither should be discovered by accident
   */
  void record(String flagKey, String action, Long actorUserId, String reason, boolean urgent);
}
