package com.avicare.parameters.api;

import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Public contract of the parameters bounded context (doc 03 §4). Business contexts (poultry,
 * health, commercial...) read parametrized values and catalogs through this facade, never through
 * the parameters repositories directly.
 */
public interface ParametersFacade {

  /** Resolve a value across the 3 layers (user &gt; farm &gt; catalog). */
  Optional<Map<String, Object>> resolve(Long userId, Long farmId, String category, String key);

  /** Resolve and convert to {@code type}, with a fallback default. */
  <T> T resolveAs(
      Long userId, Long farmId, String category, String key, Class<T> type, T defaultValue);

  /** The effective catalog of a category for a farm (platform items + farm customizations). */
  List<CatalogEntryInfo> listForFarm(Long farmId, String category);
}
