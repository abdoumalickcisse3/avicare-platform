package com.avicare.subscription.domain;

/** Lifecycle status of a {@link Subscription}. Mirrors the {@code subscriptions.status} CHECK. */
public enum SubscriptionStatus {
  TRIAL,
  ACTIVE,
  SUSPENDED,
  CANCELLED,
  EXPIRED
}
