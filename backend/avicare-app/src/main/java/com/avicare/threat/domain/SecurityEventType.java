package com.avicare.threat.domain;

/** What happened. Mirrors the CHECK constraint in V51 — adding one means a migration. */
public enum SecurityEventType {
  FAILED_LOGIN,
  BRUTEFORCE_DETECTED,
  RATE_LIMIT_EXCEEDED,
  SIGNUP_ANOMALY,
  IP_BLOCKED,
  IP_UNBLOCKED
}
