package com.avicare.livestock.domain;

/**
 * Whether a {@link ProductionUnit} tracks a group as a whole or a single animal:
 *
 * <ul>
 *   <li>{@link #BATCH} — a flock/lot counted collectively (poultry, V1)
 *   <li>{@link #INDIVIDUAL} — one animal (small ruminants, cattle; V2+)
 * </ul>
 */
public enum UnitKind {
  BATCH,
  INDIVIDUAL
}
