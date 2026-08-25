package com.avicare.partner.service;

/**
 * How closely a partner should watch a member farm, derived from how long the farm has gone without
 * entering anything. {@code WATCH} is deliberately silent (shown in the network table, no alert and
 * no push) so the partner sees a farm slipping before it gets notified about it.
 */
public enum RiskLevel {
  OK,
  WATCH,
  AT_RISK
}
