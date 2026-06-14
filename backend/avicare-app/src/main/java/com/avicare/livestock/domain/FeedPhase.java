package com.avicare.livestock.domain;

/**
 * Feeding phase a formula targets (Sprint B4-4). Mirrored by a CHECK constraint in V18. {@code
 * OTHER} is the escape hatch for non-standard phases.
 */
public enum FeedPhase {
  STARTER,
  GROWER,
  FINISHER,
  PRE_LAYER,
  LAYER,
  BREEDER,
  OTHER
}
