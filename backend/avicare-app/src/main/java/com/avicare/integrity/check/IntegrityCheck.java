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
   * Everything currently wrong.
   *
   * @param graceCutoff ignore anything touched after this instant. A farm in Dakar may well be
   *     writing while the sweep runs at 3am, and a half-committed workflow is not a defect — it is
   *     a farmer mid-sentence. Without this the first client gets a CRITICAL alert for an invoice
   *     they were in the middle of paying.
   */
  List<FindingCandidate> run(LocalDateTime graceCutoff);
}
