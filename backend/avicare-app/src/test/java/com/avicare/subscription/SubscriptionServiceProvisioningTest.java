package com.avicare.subscription;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import com.avicare.subscription.domain.FeatureMode;
import com.avicare.subscription.domain.Subscription;
import com.avicare.subscription.domain.SubscriptionModule;
import com.avicare.subscription.domain.SubscriptionStatus;
import com.avicare.subscription.repository.SubscriptionModuleRepository;
import com.avicare.subscription.repository.SubscriptionRepository;
import com.avicare.subscription.service.SubscriptionService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SubscriptionServiceProvisioningTest {

  @Mock SubscriptionRepository subscriptionRepository;
  @Mock SubscriptionModuleRepository subscriptionModuleRepository;
  @Mock ParametersFacade parametersFacade;

  SubscriptionService service;

  static final Long FARM = 7L;

  @BeforeEach
  void setUp() {
    service =
        new SubscriptionService(
            subscriptionRepository, subscriptionModuleRepository, parametersFacade);
  }

  private static CatalogEntryInfo mod(String key, String wave) {
    return new CatalogEntryInfo("modules", key, Map.of("label", key, "wave", wave), false);
  }

  private static SubscriptionModule moduleRow(String key) {
    SubscriptionModule m = new SubscriptionModule();
    m.setModuleKey(key);
    m.setMode(FeatureMode.HARD);
    return m;
  }

  @Test
  void newFarmGetsAllV1ModulesActive() {
    when(subscriptionRepository.findByFarmId(FARM)).thenReturn(Optional.empty());
    when(subscriptionRepository.save(any(Subscription.class)))
        .thenAnswer(
            inv -> {
              Subscription s = inv.getArgument(0);
              s.setId(100L);
              return s;
            });
    when(subscriptionModuleRepository.findBySubscriptionId(100L)).thenReturn(List.of());
    when(parametersFacade.listPlatform("modules"))
        .thenReturn(
            List.of(
                mod("module.poultry.broiler", "V1"),
                mod("module.inventory", "V1"),
                mod("module.smallruminants.fattening", "V2"),
                mod("module.cattle.beef", "V3")));

    Subscription sub = service.getOrCreate(FARM);

    assertThat(sub.getStatus()).isEqualTo(SubscriptionStatus.TRIAL);
    ArgumentCaptor<SubscriptionModule> cap = ArgumentCaptor.forClass(SubscriptionModule.class);
    verify(subscriptionModuleRepository, times(2)).save(cap.capture());
    assertThat(cap.getAllValues())
        .extracting(SubscriptionModule::getModuleKey)
        .containsExactlyInAnyOrder("module.poultry.broiler", "module.inventory");
    assertThat(cap.getAllValues())
        .allSatisfy(
            m -> {
              assertThat(m.getSubscriptionId()).isEqualTo(100L);
              assertThat(m.getMode()).isEqualTo(FeatureMode.HARD);
              assertThat(m.getExpiresAt()).isNull();
            });
  }

  @Test
  void existingPartialSubscriptionIsToppedUp() {
    // Reproduces the farm-25 bug: a subscription created empty/partial before provisioning must be
    // healed on next access — only the MISSING V1 modules are inserted, never re-adding existing
    // ones.
    Subscription existing = new Subscription();
    existing.setId(200L);
    existing.setFarmId(FARM);
    existing.setStatus(SubscriptionStatus.TRIAL);
    when(subscriptionRepository.findByFarmId(FARM)).thenReturn(Optional.of(existing));
    when(subscriptionModuleRepository.findBySubscriptionId(200L))
        .thenReturn(List.of(moduleRow("module.poultry.broiler"))); // already has broiler
    when(parametersFacade.listPlatform("modules"))
        .thenReturn(
            List.of(
                mod("module.poultry.broiler", "V1"),
                mod("module.inventory", "V1"),
                mod("module.cattle.beef", "V3")));

    Subscription sub = service.getOrCreate(FARM);

    assertThat(sub).isSameAs(existing);
    ArgumentCaptor<SubscriptionModule> cap = ArgumentCaptor.forClass(SubscriptionModule.class);
    verify(subscriptionModuleRepository, times(1)).save(cap.capture());
    assertThat(cap.getValue().getModuleKey()).isEqualTo("module.inventory");
    assertThat(cap.getValue().getSubscriptionId()).isEqualTo(200L);
    assertThat(cap.getValue().getMode()).isEqualTo(FeatureMode.HARD);
  }

  @Test
  void completeSubscriptionGetsNoInserts() {
    Subscription existing = new Subscription();
    existing.setId(300L);
    existing.setFarmId(FARM);
    existing.setStatus(SubscriptionStatus.TRIAL);
    when(subscriptionRepository.findByFarmId(FARM)).thenReturn(Optional.of(existing));
    when(subscriptionModuleRepository.findBySubscriptionId(300L))
        .thenReturn(List.of(moduleRow("module.poultry.broiler"), moduleRow("module.inventory")));
    when(parametersFacade.listPlatform("modules"))
        .thenReturn(List.of(mod("module.poultry.broiler", "V1"), mod("module.inventory", "V1")));

    service.getOrCreate(FARM);

    verify(subscriptionModuleRepository, never()).save(any());
  }
}
