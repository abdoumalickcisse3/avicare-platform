package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import java.time.LocalDateTime;
import java.util.List;

/**
 * One invariant the platform's data is supposed to satisfy.
 *
 * <p>Every implementation reads through plain SQL rather than the repositories that wrote the data.
 * That is deliberate: 26 entities carry {@code @SQLRestriction}, so an ORM read would silently
 * inherit the very filters that hide broken rows, and a checker that cannot see a defect is worse
 * than no checker.
 */
public interface IntegrityCheck {

  /** Stable identifier, stored on every finding — renaming one re-opens its findings. */
  String key();

  /** French one-liner shown in the console. */
  String label();

  Severity severity();

  /**
   * Whether offering « Recalculer » on this check's findings means anything.
   *
   * <p>The entity type alone cannot decide it. {@code stock_item} is a recomputable type — the
   * quantity is derived from the movement journal — yet recomputing a <b>negative</b> stock puts
   * back the last movement's own figure, which is negative too: the console would report {@code
   * -105 -> -105} and claim success having changed nothing. The check knows that; the type does
   * not.
   *
   * <p>Default {@code true}: a new check inherits the behaviour its entity type already had, and
   * only a check with a reason to say otherwise says otherwise.
   */
  default boolean recomputable() {
    return true;
  }

  /**
   * Everything currently wrong.
   *
   * @param graceCutoff ignore anything touched after this instant. A farm in Dakar may well be
   *     writing while the sweep runs at 3am, and a half-committed workflow is not a defect — it is
   *     a farmer mid-sentence. Without this the first client gets a CRITICAL alert for an invoice
   *     they were in the middle of paying.
   */
  List<FindingCandidate> run(LocalDateTime graceCutoff);
}
