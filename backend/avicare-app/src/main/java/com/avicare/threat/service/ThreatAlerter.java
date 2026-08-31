package com.avicare.threat.service;

/**
 * Port for telling the platform's own people that someone is knocking too hard.
 *
 * <p>Declared here, implemented in the back-office — the same shape as the ports in the gating and
 * integrity contexts, so the detection code never has to import the audit trail or the WhatsApp
 * rail.
 */
public interface ThreatAlerter {

  /** An address was blocked, or unblocked. Both are worth a line in the trail. */
  void ipBlockChanged(String ip, boolean blocked, String reason, String by);

  /** Something we would want to hear about tonight rather than tomorrow. */
  void criticalThreat(String summary, String ip, String email);
}
