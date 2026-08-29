package com.avicare.admin.spi;

import java.util.Map;

/**
 * One bounded context's contribution to a farm data export (GDPR portability).
 *
 * <p>The back-office must never read another context's entities, and widening every facade with an
 * {@code exportEverything} method would put the console's concern inside domains that do not share
 * it. So the direction is inverted, following the {@code identity/spi} precedent: the console
 * declares what it needs, each context implements it and owns its own section.
 *
 * <p>Spring injects every implementation as a list, so a context added later contributes to the
 * export without the console being touched — and a context that contributes nothing is visible as a
 * missing section rather than silently absent.
 */
public interface FarmDataExporter {

  /** Stable key of this contribution in the bundle, e.g. {@code "flocks"}. */
  String section();

  /**
   * Everything this context holds for {@code farmId}, as plain serializable values.
   *
   * <p>Returned as maps rather than entities on purpose: an export is a snapshot the farmer keeps,
   * not a view that should change shape when an entity is refactored.
   */
  Map<String, Object> export(Long farmId);
}
