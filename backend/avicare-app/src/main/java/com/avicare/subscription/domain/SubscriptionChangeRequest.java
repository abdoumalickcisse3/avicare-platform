package com.avicare.subscription.domain;

import com.fasterxml.jackson.databind.JsonNode;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * A requested change to a subscription, moving through the review workflow (Décision 16). The
 * requester and reviewer are referenced by user id. {@code requestedModules} is a free-form JSONB
 * payload kept as a {@link JsonNode} to allow either an object or array shape.
 */
@Entity
@Table(name = "subscription_change_requests")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class SubscriptionChangeRequest {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "subscription_id", nullable = false)
  private Long subscriptionId;

  @Column(name = "requested_plan")
  private String requestedPlan;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "requested_modules")
  private JsonNode requestedModules;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private RequestStatus status = RequestStatus.DRAFT;

  @Column(name = "requested_by", nullable = false)
  private Long requestedBy;

  @Column(name = "reviewer_id")
  private Long reviewerId;

  @Column(name = "reviewed_at")
  private LocalDateTime reviewedAt;

  @Column private String reason;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
