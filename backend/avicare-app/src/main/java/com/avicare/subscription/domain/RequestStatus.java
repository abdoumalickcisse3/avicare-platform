package com.avicare.subscription.domain;

/**
 * Status of a {@link SubscriptionChangeRequest} in its review workflow (Décision 16): {@code DRAFT
 * → SUBMITTED → APPROVED | REJECTED}.
 */
public enum RequestStatus {
  DRAFT,
  SUBMITTED,
  APPROVED,
  REJECTED
}
