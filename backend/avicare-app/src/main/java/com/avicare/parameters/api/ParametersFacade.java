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

  /** The platform-level catalog of a category (no farm context, e.g. subscription plans). */
  List<CatalogEntryInfo> listPlatform(String category);

  /** Upsert a farm-level setting (layer 2). Value is a JSON object (wrap scalars/arrays). */
  void setFarmSetting(Long farmId, String key, Map<String, Object> value);

  /** Upsert a farm-level catalog entry (custom or override); returns the effective view. */
  CatalogEntryInfo override(Long farmId, String category, String key, Map<String, Object> value);

  /** Remove/disable a farm-level catalog entry so it no longer appears in {@link #listForFarm}. */
  void delete(Long farmId, String category, String key);

  /**
   * Upsert a platform-level catalog entry (layer 1).
   *
   * <p>Deliberately narrow: platform settings such as the health thresholds or the benchmark floor
   * live in the catalog rather than in constants, and the screens that own them need a way to write
   * one — the generic catalog editor keeps those categories read-only precisely so they are edited
   * here, in a shape the writing screen understands.
   */
  CatalogEntryInfo setPlatformEntry(String category, String key, Map<String, Object> value);
}
