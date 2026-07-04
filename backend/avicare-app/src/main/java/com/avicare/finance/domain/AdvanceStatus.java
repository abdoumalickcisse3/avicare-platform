package com.avicare.finance.domain;

/**
 * Salary advance request status (Sprint B6 P2).
 *
 * <p>{@code PENDING}: advance requested, awaiting decision. {@code APPROVED}: advance approved by
 * farm owner/manager. {@code REJECTED}: advance rejected.
 */
public enum AdvanceStatus {
  PENDING,
  APPROVED,
  REJECTED
}
