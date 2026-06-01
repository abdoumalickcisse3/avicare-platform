package com.avicare.subscription.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.subscription.domain.FeatureMode;
import com.avicare.subscription.domain.RequestStatus;
import com.avicare.subscription.domain.Subscription;
import com.avicare.subscription.domain.SubscriptionChangeRequest;
import com.avicare.subscription.repository.SubscriptionChangeRequestRepository;
import com.avicare.subscription.repository.SubscriptionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for {@link ChangeRequestService} workflow transitions and approval side effects. */
class ChangeRequestServiceTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private SubscriptionChangeRequestRepository changeRequestRepository;
  private SubscriptionRepository subscriptionRepository;
  private SubscriptionService subscriptionService;
  private ChangeRequestService service;

  @BeforeEach
  void setUp() {
    changeRequestRepository = Mockito.mock(SubscriptionChangeRequestRepository.class);
    subscriptionRepository = Mockito.mock(SubscriptionRepository.class);
    subscriptionService = Mockito.mock(SubscriptionService.class);
    service =
        new ChangeRequestService(
            changeRequestRepository, subscriptionRepository, subscriptionService);
  }

  private SubscriptionChangeRequest request(RequestStatus status) {
    SubscriptionChangeRequest r = new SubscriptionChangeRequest();
    r.setId(1L);
    r.setSubscriptionId(10L);
    r.setStatus(status);
    return r;
  }

  @Test
  void submit_draftToSubmitted() {
    when(changeRequestRepository.findById(1L))
        .thenReturn(Optional.of(request(RequestStatus.DRAFT)));

    assertThat(service.submit(1L).getStatus()).isEqualTo(RequestStatus.SUBMITTED);
  }

  @Test
  void submit_nonDraft_throws422() {
    when(changeRequestRepository.findById(1L))
        .thenReturn(Optional.of(request(RequestStatus.SUBMITTED)));

    assertThatThrownBy(() -> service.submit(1L)).isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void approve_appliesModulesAndPlan_andMarksApproved() {
    SubscriptionChangeRequest r = request(RequestStatus.SUBMITTED);
    ArrayNode modules =
        MAPPER.createArrayNode().add("module.poultry.broiler").add("module.inventory");
    r.setRequestedModules(modules);
    r.setRequestedPlan("pro_volaille");
    when(changeRequestRepository.findById(1L)).thenReturn(Optional.of(r));

    Subscription sub = new Subscription();
    sub.setId(10L);
    sub.setFarmId(7L);
    when(subscriptionRepository.findById(10L)).thenReturn(Optional.of(sub));
    when(subscriptionService.get(7L)).thenReturn(sub);

    SubscriptionChangeRequest approved = service.approve(1L, 99L);

    assertThat(approved.getStatus()).isEqualTo(RequestStatus.APPROVED);
    assertThat(approved.getReviewerId()).isEqualTo(99L);
    assertThat(approved.getReviewedAt()).isNotNull();
    assertThat(sub.getPlanKey()).isEqualTo("pro_volaille");
    verify(subscriptionService)
        .enableModule(eq(7L), eq("module.poultry.broiler"), eq(FeatureMode.HARD), any());
    verify(subscriptionService)
        .enableModule(eq(7L), eq("module.inventory"), eq(FeatureMode.HARD), any());
  }

  @Test
  void approve_nonSubmitted_throws422() {
    when(changeRequestRepository.findById(1L))
        .thenReturn(Optional.of(request(RequestStatus.DRAFT)));

    assertThatThrownBy(() -> service.approve(1L, 99L)).isInstanceOf(BusinessRuleException.class);
  }

  @Test
  void reject_submittedToRejectedWithReason() {
    when(changeRequestRepository.findById(1L))
        .thenReturn(Optional.of(request(RequestStatus.SUBMITTED)));

    SubscriptionChangeRequest rejected = service.reject(1L, 99L, "budget");

    assertThat(rejected.getStatus()).isEqualTo(RequestStatus.REJECTED);
    assertThat(rejected.getReason()).isEqualTo("budget");
    assertThat(rejected.getReviewerId()).isEqualTo(99L);
  }
}
