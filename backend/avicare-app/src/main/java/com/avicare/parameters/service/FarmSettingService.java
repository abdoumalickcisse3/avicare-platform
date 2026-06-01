package com.avicare.parameters.service;

import com.avicare.parameters.domain.CatalogItem;
import com.avicare.parameters.domain.FarmSetting;
import com.avicare.parameters.domain.UserSetting;
import com.avicare.parameters.repository.CatalogItemRepository;
import com.avicare.parameters.repository.FarmSettingRepository;
import com.avicare.parameters.repository.UserSettingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The central 3-layer parametrization lookup (doc 06 §3). A value is resolved from the most
 * specific layer down to the most general:
 *
 * <ol>
 *   <li>layer 3 — {@code user_settings} (the connected user's preference)
 *   <li>layer 2 — {@code farm_settings} (the farm admin's override)
 *   <li>layer 1 — {@code catalog_items} (the platform default; localized row first, then the
 *       universal {@code locale = null} row)
 * </ol>
 *
 * <p>The category cannot be derived from the key, so it is always passed explicitly. Values are
 * JSONB objects, surfaced as {@code Map<String, Object>} to match the entity mapping.
 */
@Service
@RequiredArgsConstructor
public class FarmSettingService {

  private static final String DEFAULT_LOCALE = "fr";

  private final UserSettingRepository userSettingRepository;
  private final FarmSettingRepository farmSettingRepository;
  private final CatalogItemRepository catalogItemRepository;
  private final ObjectMapper objectMapper;

  /** Resolve a value across the 3 layers using the default locale. */
  @Transactional(readOnly = true)
  public Optional<Map<String, Object>> resolve(
      Long userId, Long farmId, String category, String key) {
    return resolve(userId, farmId, category, key, DEFAULT_LOCALE);
  }

  /** Resolve a value across the 3 layers (user &gt; farm &gt; catalog). */
  @Transactional(readOnly = true)
  public Optional<Map<String, Object>> resolve(
      Long userId, Long farmId, String category, String key, String locale) {
    if (userId != null) {
      Optional<Map<String, Object>> userValue =
          userSettingRepository.findByUserIdAndKey(userId, key).map(UserSetting::getValue);
      if (userValue.isPresent()) {
        return userValue;
      }
    }
    if (farmId != null) {
      Optional<Map<String, Object>> farmValue =
          farmSettingRepository.findByFarmIdAndKey(farmId, key).map(FarmSetting::getValue);
      if (farmValue.isPresent()) {
        return farmValue;
      }
    }
    return catalogItemRepository
        .findByCategoryAndKeyAndLocale(category, key, locale)
        .or(() -> catalogItemRepository.findByCategoryAndKeyAndLocale(category, key, null))
        .map(CatalogItem::getValue);
  }

  /**
   * Resolve and convert the value to {@code type}, returning {@code defaultValue} when no layer
   * defines the key.
   */
  @Transactional(readOnly = true)
  public <T> T resolveAs(
      Long userId, Long farmId, String category, String key, Class<T> type, T defaultValue) {
    return resolve(userId, farmId, category, key)
        .map(value -> objectMapper.convertValue(value, type))
        .orElse(defaultValue);
  }

  /** Upsert a farm-level setting (layer 2). */
  @Transactional
  public FarmSetting setFarmSetting(Long farmId, String key, Map<String, Object> value) {
    FarmSetting setting =
        farmSettingRepository.findByFarmIdAndKey(farmId, key).orElseGet(FarmSetting::new);
    setting.setFarmId(farmId);
    setting.setKey(key);
    setting.setValue(value);
    return farmSettingRepository.save(setting);
  }

  /** Upsert a user-level preference (layer 3). */
  @Transactional
  public UserSetting setUserSetting(Long userId, String key, Map<String, Object> value) {
    UserSetting setting =
        userSettingRepository.findByUserIdAndKey(userId, key).orElseGet(UserSetting::new);
    setting.setUserId(userId);
    setting.setKey(key);
    setting.setValue(value);
    return userSettingRepository.save(setting);
  }

  @Transactional(readOnly = true)
  public List<FarmSetting> getFarmSettings(Long farmId) {
    return farmSettingRepository.findByFarmId(farmId);
  }

  @Transactional(readOnly = true)
  public List<UserSetting> getUserSettings(Long userId) {
    return userSettingRepository.findByUserId(userId);
  }
}
