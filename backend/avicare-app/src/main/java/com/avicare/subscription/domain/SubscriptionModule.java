package com.avicare.subscription.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A single feature entitlement on a subscription: which {@code module_key} is granted and in which
 * {@link FeatureMode}. One row per (subscription, module_key).
 */
@Entity
@Table(
    name = "subscription_modules",
    uniqueConstraints = @UniqueConstraint(columnNames = {"subscription_id", "module_key"}))
@Getter
@Setter
@NoArgsConstructor
@ToString
public class SubscriptionModule {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "subscription_id", nullable = false)
  private Long subscriptionId;

  @Column(name = "module_key", nullable = false)
  private String moduleKey;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private FeatureMode mode = FeatureMode.OFF;

  @Column(name = "expires_at")
  private LocalDateTime expiresAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
