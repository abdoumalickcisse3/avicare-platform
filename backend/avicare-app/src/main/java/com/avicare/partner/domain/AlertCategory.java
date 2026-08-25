package com.avicare.partner.domain;

/**
 * Kind of network alert raised for a partner (couche « Garder »). {@code FARM_SILENT} = a member
 * farm stopped entering data (churn signal, detected by the daily scan); {@code FARM_LEFT} = a farm
 * left the network (a one-off event, never reconciled by the scan).
 */
public enum AlertCategory {
  FARM_SILENT,
  FARM_LEFT
}
