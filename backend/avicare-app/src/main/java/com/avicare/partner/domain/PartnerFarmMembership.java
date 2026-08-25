package com.avicare.partner.domain;

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
 * The link between a farm and a partner network. Farm and partner referenced by id. The five {@code
 * share*} booleans are the farmer-controlled sharing sliders (default: operational ON, money OFF).
 * No soft delete: lifecycle is carried by {@link MembershipStatus} (LEFT).
 */
@Entity
@Table(name = "partner_farm_memberships")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class PartnerFarmMembership {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "partner_id", nullable = false)
  private Long partnerId;

  @Column(name = "farm_id", nullable = false)
  private Long farmId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private MembershipStatus status = MembershipStatus.DECLARED;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private MembershipOrigin origin;

  @Column(name = "invite_code_id")
  private Long inviteCodeId;

  @Column(name = "share_activity", nullable = false)
  private boolean shareActivity = true;

  @Column(name = "share_flock_health", nullable = false)
  private boolean shareFlockHealth = true;

  @Column(name = "share_feed_consumption", nullable = false)
  private boolean shareFeedConsumption = true;

  @Column(name = "share_sales_volume", nullable = false)
  private boolean shareSalesVolume = false;

  @Column(name = "share_finances", nullable = false)
  private boolean shareFinances = false;

  /** Off by default: a restock forecast is a commercially actionable prediction, not a state. */
  @Column(name = "share_restock_forecast", nullable = false)
  private boolean shareRestockForecast = false;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "confirmed_at")
  private LocalDateTime confirmedAt;

  @Column(name = "left_at")
  private LocalDateTime leftAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
