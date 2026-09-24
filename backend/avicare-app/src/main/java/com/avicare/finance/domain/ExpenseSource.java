package com.avicare.finance.domain;

/**
 * Source of an expense entry.
 *
 * <p>MANUAL = manual entry by user; PURCHASE = auto-recorded from purchase order receipt;
 * STOCK_ENTRY = auto-recorded from stock movement valuation; SALARY = auto-recorded from payroll
 * (Sprint B6 P2); VET_VISIT = auto-recorded from a vet visit cost; CHICK_PURCHASE = auto-recorded
 * chick purchase cost, from batch reception or a later correction.
 */
public enum ExpenseSource {
  MANUAL,
  PURCHASE,
  STOCK_ENTRY,
  SALARY,
  VET_VISIT,
  CHICK_PURCHASE
}
