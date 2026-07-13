package com.avicare.parameters.service;

import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Default {@link ParametersFacade} implementation, delegating to the parameters services. */
@Service
@RequiredArgsConstructor
public class ParametersFacadeImpl implements ParametersFacade {

  private final FarmSettingService farmSettingService;
  private final CatalogService catalogService;

  @Override
  public Optional<Map<String, Object>> resolve(
      Long userId, Long farmId, String category, String key) {
    return farmSettingService.resolve(userId, farmId, category, key);
  }

  @Override
  public <T> T resolveAs(
      Long userId, Long farmId, String category, String key, Class<T> type, T defaultValue) {
    return farmSettingService.resolveAs(userId, farmId, category, key, type, defaultValue);
  }

  @Override
  public List<CatalogEntryInfo> listForFarm(Long farmId, String category) {
    return catalogService.listForFarm(farmId, category).stream()
        .map(e -> new CatalogEntryInfo(e.category(), e.key(), e.value(), e.custom()))
        .toList();
  }

  @Override
  public List<CatalogEntryInfo> listPlatform(String category) {
    return catalogService.listPlatform(category).stream()
        .map(e -> new CatalogEntryInfo(e.category(), e.key(), e.value(), e.custom()))
        .toList();
  }

  @Override
  public void setFarmSetting(Long farmId, String key, Map<String, Object> value) {
    farmSettingService.setFarmSetting(farmId, key, value);
  }

  @Override
  public CatalogEntryInfo override(
      Long farmId, String category, String key, Map<String, Object> value) {
    var item = catalogService.override(farmId, category, key, value);
    return new CatalogEntryInfo(
        item.getCategory(), item.getKey(), item.getValue(), item.getCatalogItemId() == null);
  }

  @Override
  public void delete(Long farmId, String category, String key) {
    catalogService.disable(farmId, category, key);
  }
}
