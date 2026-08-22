package com.avicare.partner.domain;

/**
 * Lifecycle of a farm's membership in a partner network. DECLARED = pending (farmer or invite
 * code); CONFIRMED = validated (admin or partner); LEFT = the farm left the network.
 */
public enum MembershipStatus {
  DECLARED,
  CONFIRMED,
  LEFT
}
