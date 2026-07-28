package com.avicare.subscription.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.subscription.domain.FeatureMode;
import com.avicare.subscription.domain.RequestStatus;
import com.avicare.subscription.domain.Subscription;
import com.avicare.subscription.domain.SubscriptionChangeRequest;
import com.avicare.subscription.repository.SubscriptionChangeRequestRepository;
import com.avicare.subscription.repository.SubscriptionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Drives the subscription change-request review workflow (Décision 16): {@code DRAFT → SUBMITTED →
 * APPROVED | REJECTED}. A farm OWNER creates and submits a request; a Jawdi platform admin approves
 * or rejects it. On approval the request is <b>applied</b>: the modules listed in {@code
 * requestedModules} (a JSON array of module keys) are enabled on the farm's subscription and the
 * {@code requestedPlan} becomes the subscription's plan.
 */
@Service
@RequiredArgsConstructor
public class ChangeRequestService {

  private final SubscriptionChangeRequestRepository changeRequestRepository;
  private final SubscriptionRepository subscriptionRepository;
  private final SubscriptionService subscriptionService;

  /**
   * Create a DRAFT change request against the farm's subscription (created on the fly if needed).
   */
  @Transactional
  public SubscriptionChangeRequest create(
      Long farmId, Long requestedByUserId, String requestedPlan, JsonNode requestedModules) {
    Subscription subscription = subscriptionService.getOrCreate(farmId);
    SubscriptionChangeRequest request = new SubscriptionChangeRequest();
    request.setSubscriptionId(subscription.getId());
    request.setRequestedPlan(requestedPlan);
    request.setRequestedModules(requestedModules);
    request.setStatus(RequestStatus.DRAFT);
    request.setRequestedBy(requestedByUserId);
    return changeRequestRepository.save(request);
  }

  /** DRAFT → SUBMITTED. */
  @Transactional
  public SubscriptionChangeRequest submit(Long requestId) {
    SubscriptionChangeRequest request = load(requestId);
    requireStatus(request, RequestStatus.DRAFT, "submit");
    request.setStatus(RequestStatus.SUBMITTED);
    return request;
  }

  /** SUBMITTED → APPROVED, applying the requested modules and plan to the subscription. */
  @Transactional
  public SubscriptionChangeRequest approve(Long requestId, Long reviewerId) {
    SubscriptionChangeRequest request = load(requestId);
    requireStatus(request, RequestStatus.SUBMITTED, "approve");

    Long farmId = farmIdOf(request);
    if (request.getRequestedModules() != null && request.getRequestedModules().isArray()) {
      for (JsonNode moduleKey : request.getRequestedModules()) {
        subscriptionService.enableModule(farmId, moduleKey.asText(), FeatureMode.HARD, null);
      }
    }
    if (request.getRequestedPlan() != null && !request.getRequestedPlan().isBlank()) {
      Subscription subscription = subscriptionService.get(farmId);
      subscription.setPlanKey(request.getRequestedPlan());
    }

    request.setStatus(RequestStatus.APPROVED);
    request.setReviewerId(reviewerId);
    request.setReviewedAt(LocalDateTime.now());
    return request;
  }

  /** SUBMITTED → REJECTED with a reason. */
  @Transactional
  public SubscriptionChangeRequest reject(Long requestId, Long reviewerId, String reason) {
    SubscriptionChangeRequest request = load(requestId);
    requireStatus(request, RequestStatus.SUBMITTED, "reject");
    request.setStatus(RequestStatus.REJECTED);
    request.setReviewerId(reviewerId);
    request.setReviewedAt(LocalDateTime.now());
    request.setReason(reason);
    return request;
  }

  @Transactional(readOnly = true)
  public List<SubscriptionChangeRequest> listForFarm(Long farmId) {
    return subscriptionRepository
        .findByFarmId(farmId)
        .map(sub -> changeRequestRepository.findBySubscriptionId(sub.getId()))
        .orElseGet(List::of);
  }

  @Transactional(readOnly = true)
  public SubscriptionChangeRequest get(Long requestId) {
    return load(requestId);
  }

  private Long farmIdOf(SubscriptionChangeRequest request) {
    return subscriptionRepository
        .findById(request.getSubscriptionId())
        .map(Subscription::getFarmId)
        .orElseThrow(() -> NotFoundException.of("Subscription", request.getSubscriptionId()));
  }

  private SubscriptionChangeRequest load(Long requestId) {
    return changeRequestRepository
        .findById(requestId)
        .orElseThrow(() -> NotFoundException.of("ChangeRequest", requestId));
  }

  private static void requireStatus(
      SubscriptionChangeRequest request, RequestStatus expected, String action) {
    if (request.getStatus() != expected) {
      throw new BusinessRuleException(
          "INVALID_CHANGE_REQUEST_TRANSITION",
          "Cannot " + action + " a change request in status " + request.getStatus());
    }
  }
}
