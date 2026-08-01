package com.avicare.subscription.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import com.avicare.subscription.domain.FeatureMode;
import com.avicare.subscription.domain.Subscription;
import com.avicare.subscription.domain.SubscriptionModule;
import com.avicare.subscription.domain.SubscriptionStatus;
import com.avicare.subscription.dto.response.PlanResponse;
import com.avicare.subscription.repository.SubscriptionModuleRepository;
import com.avicare.subscription.repository.SubscriptionRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages a farm's subscription and its activated feature modules (no bundles table — Décision 15).
 *
 * <p>Feature gating semantics (Décision 14, V1): a module is <b>enabled</b> for a farm when a
 * non-expired {@link SubscriptionModule} row exists for it — presence is the gate. The {@link
 * FeatureMode} ({@code OFF}/{@code HARD}) qualifies how a <i>non-enabled</i> module is refused at
 * the UX level (silent 403 vs "upgrade your plan"); it is not the on/off switch itself.
 */
@Service
@RequiredArgsConstructor
public class SubscriptionService {

  static final String CATEGORY_BUNDLES = "bundles";
  static final String WAVE_V1 = "V1";

  private final SubscriptionRepository subscriptionRepository;
  private final SubscriptionModuleRepository subscriptionModuleRepository;
  private final ParametersFacade parametersFacade;

  /**
   * The V1 subscription plans (pré-bundles), assembled from the {@code bundles} catalog — the
   * backend source of truth for the Plan → Modules mapping (Décision 16).
   */
  @Transactional(readOnly = true)
  public List<PlanResponse> listPlans() {
    return parametersFacade.listPlatform(CATEGORY_BUNDLES).stream()
        .map(e -> toPlan(e.key(), e.value()))
        .filter(p -> WAVE_V1.equals(p.wave()))
        .toList();
  }

  /**
   * Apply a plan to a farm: resolve its modules from the catalog, reconcile the farm's modules to
   * exactly that set (enable missing, disable extras — V1 has no à-la-carte so every module is
   * plan-managed) and set {@code plan_key}. Idempotent: re-applying the same plan is a no-op. A
   * custom (quote) plan cannot be self-applied; an unknown / non-V1 plan is a 404.
   */
  @Transactional
  public Subscription applyPlan(Long farmId, String planKey) {
    Map<String, Object> plan =
        parametersFacade.listPlatform(CATEGORY_BUNDLES).stream()
            .filter(e -> e.key().equals(planKey))
            .map(CatalogEntryInfo::value)
            .findFirst()
            .orElseThrow(() -> new NotFoundException("PLAN_NOT_FOUND", "Unknown plan " + planKey));
    if (!WAVE_V1.equals(plan.get("wave"))) {
      throw new NotFoundException("PLAN_NOT_FOUND", "Plan " + planKey + " is not available in V1");
    }
    if (Boolean.TRUE.equals(plan.get("custom"))) {
      throw new BusinessRuleException(
          "PLAN_REQUIRES_QUOTE", "Plan " + planKey + " requires a custom quote");
    }

    Subscription subscription = getOrCreate(farmId);
    if (planKey.equals(subscription.getPlanKey())) {
      return subscription; // already on this plan — no-op
    }

    @SuppressWarnings("unchecked")
    List<String> targetModules = (List<String>) plan.getOrDefault("modules", List.of());
    Set<String> target = Set.copyOf(targetModules);
    Set<String> current =
        listModulesOrEmpty(subscription.getId()).stream()
            .map(SubscriptionModule::getModuleKey)
            .collect(Collectors.toSet());

    target.stream()
        .filter(m -> !current.contains(m))
        .forEach(m -> enableModule(farmId, m, FeatureMode.HARD, null));
    current.stream().filter(m -> !target.contains(m)).forEach(m -> disableModule(farmId, m));

    subscription.setPlanKey(planKey);
    return subscriptionRepository.save(subscription);
  }

  private List<SubscriptionModule> listModulesOrEmpty(Long subscriptionId) {
    return subscriptionModuleRepository.findBySubscriptionId(subscriptionId);
  }

  private PlanResponse toPlan(String key, Map<String, Object> v) {
    @SuppressWarnings("unchecked")
    List<String> modules = (List<String>) v.getOrDefault("modules", List.of());
    @SuppressWarnings("unchecked")
    Map<String, Object> quotas = (Map<String, Object>) v.get("quotas");
    Integer price = v.get("price_xof") instanceof Number n ? n.intValue() : null;
    return new PlanResponse(
        key,
        (String) v.get("label"),
        price,
        modules,
        quotas,
        Boolean.TRUE.equals(v.get("recommended")),
        Boolean.TRUE.equals(v.get("custom")),
        (String) v.get("wave"));
  }

  /**
   * Return the farm's subscription, creating a TRIAL one on first access, and ensure it carries
   * every V1 module (free-pilot top-up, see {@link #ensureAllV1Modules}).
   */
  @Transactional
  public Subscription getOrCreate(Long farmId) {
    Subscription subscription =
        subscriptionRepository
            .findByFarmId(farmId)
            .orElseGet(
                () -> {
                  Subscription sub = new Subscription();
                  sub.setFarmId(farmId);
                  sub.setStatus(SubscriptionStatus.TRIAL);
                  return subscriptionRepository.save(sub);
                });
    ensureAllV1Modules(subscription);
    return subscription;
  }

  /**
   * Free-pilot provisioning (ADR-009): when the farm's subscription has <b>no</b> modules yet,
   * activate every V1-wave module so the whole product is usable without any subscription
   * management. Runs on a brand-new farm (created empty) and self-heals a pre-existing empty
   * subscription (e.g. one created before provisioning existed — the farm-25 case). A subscription
   * that already carries a curated set is left untouched, so {@code applyPlan} (dormant self-serve)
   * still resolves to its plan's subset. The V1 set is derived from the {@code modules} catalog
   * ({@code value.wave == "V1"}) — no hardcoded list that could drift. Reversible lever for future
   * monetization: drop this provisioning.
   */
  private void ensureAllV1Modules(Subscription subscription) {
    if (!subscriptionModuleRepository.findBySubscriptionId(subscription.getId()).isEmpty()) {
      return; // already has modules — respect the current set
    }
    parametersFacade.listPlatform("modules").stream()
        .filter(e -> WAVE_V1.equals(e.value().get("wave")))
        .map(CatalogEntryInfo::key)
        .forEach(
            moduleKey -> {
              SubscriptionModule module = new SubscriptionModule();
              module.setSubscriptionId(subscription.getId());
              module.setModuleKey(moduleKey);
              module.setMode(FeatureMode.HARD);
              module.setExpiresAt(null);
              subscriptionModuleRepository.save(module);
            });
  }

  @Transactional(readOnly = true)
  public Subscription get(Long farmId) {
    return subscriptionRepository
        .findByFarmId(farmId)
        .orElseThrow(
            () ->
                new NotFoundException(
                    "SUBSCRIPTION_NOT_FOUND", "No subscription for farm " + farmId));
  }

  @Transactional(readOnly = true)
  public List<SubscriptionModule> listModules(Long farmId) {
    return subscriptionModuleRepository.findBySubscriptionId(get(farmId).getId());
  }

  /** Enable (or update) a module on the farm's subscription. Creates the subscription if needed. */
  @Transactional
  public SubscriptionModule enableModule(
      Long farmId, String moduleKey, FeatureMode mode, LocalDateTime expiresAt) {
    Subscription subscription = getOrCreate(farmId);
    SubscriptionModule module =
        subscriptionModuleRepository
            .findBySubscriptionIdAndModuleKey(subscription.getId(), moduleKey)
            .orElseGet(SubscriptionModule::new);
    module.setSubscriptionId(subscription.getId());
    module.setModuleKey(moduleKey);
    module.setMode(mode != null ? mode : FeatureMode.HARD);
    module.setExpiresAt(expiresAt);
    return subscriptionModuleRepository.save(module);
  }

  /** Remove a module from the farm's subscription (idempotent). */
  @Transactional
  public void disableModule(Long farmId, String moduleKey) {
    subscriptionRepository
        .findByFarmId(farmId)
        .flatMap(
            sub ->
                subscriptionModuleRepository.findBySubscriptionIdAndModuleKey(
                    sub.getId(), moduleKey))
        .ifPresent(subscriptionModuleRepository::delete);
  }

  /**
   * Whether {@code moduleKey} is enabled for the farm: a subscription module row exists and is not
   * expired.
   *
   * <p>Free-pilot (ADR-009): this first calls {@link #getOrCreate} so a farm's subscription is
   * provisioned with every V1 module on the first gated access. This self-heals farms created
   * without provisioning (e.g. via the onboarding wizard, which no longer touches the subscription
   * endpoints) instead of returning a spurious 403. {@code getOrCreate} is idempotent and leaves a
   * curated module set untouched.
   */
  @Transactional
  public boolean isModuleEnabled(Long farmId, String moduleKey) {
    Subscription subscription = getOrCreate(farmId);
    return subscriptionModuleRepository
        .findBySubscriptionIdAndModuleKey(subscription.getId(), moduleKey)
        .filter(m -> m.getExpiresAt() == null || m.getExpiresAt().isAfter(LocalDateTime.now()))
        .isPresent();
  }
}
