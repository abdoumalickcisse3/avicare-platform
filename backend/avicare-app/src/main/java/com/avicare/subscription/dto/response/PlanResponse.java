package com.avicare.subscription.dto.response;

import java.util.List;
import java.util.Map;

/**
 * HTTP view of a subscription plan (a V1 pré-bundle), assembled from the {@code bundles} catalog
 * (Décision 15/16). {@code quotas} are indicative only — not enforced (marketing soft, Option 3).
 * {@code custom} plans (sur mesure) are quote-only and cannot be self-applied.
 */
public record PlanResponse(
    String key,
    String label,
    Integer priceXof,
    List<String> modules,
    Map<String, Object> quotas,
    boolean recommended,
    boolean custom,
    String wave) {}
