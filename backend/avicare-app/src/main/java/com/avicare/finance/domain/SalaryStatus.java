package com.avicare.finance.domain;

/**
 * Salary payment status (Sprint B6 P2).
 *
 * <p>{@code DUE}: salary calculated and issued, awaiting payment. {@code PAID}: salary paid to
 * employee.
 */
public enum SalaryStatus {
  DUE,
  PAID
}
