package com.avicare.subscription.domain;

/**
 * Feature-gating mode of a {@link SubscriptionModule}. V1 supports only two modes (Décision 14 —
 * SHADOW/SOFT deferred):
 *
 * <ul>
 *   <li>{@link #OFF} — module disabled (403 on its endpoints)
 *   <li>{@link #HARD} — module disabled with an upgrade prompt
 * </ul>
 */
public enum FeatureMode {
  OFF,
  HARD
}
