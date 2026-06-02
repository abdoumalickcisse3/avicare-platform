package com.avicare.livestock.domain;

/**
 * Livestock species handled by the platform across waves (doc 00 §6). V1 ships POULTRY only; the
 * other values are declared now so the {@code ProductionUnit} socle and transverse contexts never
 * change when a species is added (Décision 1/5).
 */
public enum Species {
  POULTRY,
  OVINE,
  BOVINE,
  CAPRINE,
  PORCINE,
  OTHER
}
