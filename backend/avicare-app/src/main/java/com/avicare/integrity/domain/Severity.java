package com.avicare.integrity.domain;

/**
 * How much an inconsistency matters.
 *
 * <p>The line that matters is CRITICAL: money or inventory that does not add up. It is the only
 * level that wakes anyone, so it must stay rare enough to be believed.
 */
public enum Severity {
  /**
   * A quality signal, not a defect: a lot with no entry for a month, a vaccination at zero dose.
   */
  INFO,
  /** Something is structurally wrong but nothing is miscounted: an orphan row, a stuck workflow. */
  WARNING,
  /** A number a farmer relies on is wrong: stock, a balance, an invoice. */
  CRITICAL
}
