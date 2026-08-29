package com.avicare.admin.spi;

import java.util.Map;

/**
 * One bounded context's contribution to the platform cockpit.
 *
 * <p>Same inversion as {@link FarmDataExporter}: the console declares what it needs, each context
 * answers with its own counters, and Spring collects them. A cockpit assembled by reaching into
 * every domain would make the console the place that breaks whenever a domain is refactored.
 *
 * <p>Keys are stable identifiers ({@code salesLast30d}); the screen owns their wording.
 */
public interface PlatformMetricsContributor {

  /** Counter name to value. Cheap queries only — this runs on every cockpit load. */
  Map<String, Long> counters();
}
