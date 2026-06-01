package com.avicare.subscription.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * A farm's subscription (one per farm). The activated features live on {@link SubscriptionModule}
 * rows (no bundles table — Décision 15). The farm is referenced by id.
 *
 * <p>{@code createdAt}/{@code updatedAt}/{@code startedAt} are owned by the DB ({@code DEFAULT
 * NOW()} + trigger) and mapped read-only.
 */
@Entity
@Table(name = "subscriptions")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class Subscription {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Column(name = "plan_key")
  private String planKey;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private SubscriptionStatus status = SubscriptionStatus.TRIAL;

  @Column(name = "started_at", insertable = false, updatable = false)
  private LocalDateTime startedAt;

  @Column(name = "expires_at")
  private LocalDateTime expiresAt;

  @Column(name = "trial_ends_at")
  private LocalDateTime trialEndsAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
