package com.avicare.threat.domain;

/**
 * How much a security event matters.
 *
 * <p>Deliberately its own enum rather than a shared one with the integrity context: the two answer
 * different questions ("is someone attacking us" vs "does the data add up") and coupling them would
 * mean one context's taxonomy constrains the other's for no benefit.
 */
public enum ThreatSeverity {
  /** Normal noise: one wrong password, one rate limit hit. */
  INFO,
  /** A pattern worth a look: repeated signups from one address. */
  WARNING,
  /** Someone is trying to get in, and we acted on it. */
  CRITICAL
}
