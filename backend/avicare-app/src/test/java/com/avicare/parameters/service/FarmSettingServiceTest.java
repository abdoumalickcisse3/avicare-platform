package com.avicare.parameters.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.avicare.parameters.domain.CatalogItem;
import com.avicare.parameters.domain.FarmSetting;
import com.avicare.parameters.domain.UserSetting;
import com.avicare.parameters.repository.CatalogItemRepository;
import com.avicare.parameters.repository.FarmSettingRepository;
import com.avicare.parameters.repository.UserSettingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for the 3-layer lookup precedence in {@link FarmSettingService} (repos mocked). */
class FarmSettingServiceTest {

  private UserSettingRepository userSettingRepository;
  private FarmSettingRepository farmSettingRepository;
  private CatalogItemRepository catalogItemRepository;
  private FarmSettingService service;

  @BeforeEach
  void setUp() {
    userSettingRepository = Mockito.mock(UserSettingRepository.class);
    farmSettingRepository = Mockito.mock(FarmSettingRepository.class);
    catalogItemRepository = Mockito.mock(CatalogItemRepository.class);
    service =
        new FarmSettingService(
            userSettingRepository,
            farmSettingRepository,
            catalogItemRepository,
            new ObjectMapper());
  }

  private void stubUser(Map<String, Object> value) {
    UserSetting s = new UserSetting();
    s.setValue(value);
    lenient()
        .when(userSettingRepository.findByUserIdAndKey(any(), any()))
        .thenReturn(value == null ? Optional.empty() : Optional.of(s));
  }

  private void stubFarm(Map<String, Object> value) {
    FarmSetting s = new FarmSetting();
    s.setValue(value);
    lenient()
        .when(farmSettingRepository.findByFarmIdAndKey(any(), any()))
        .thenReturn(value == null ? Optional.empty() : Optional.of(s));
  }

  private void stubCatalog(String locale, Map<String, Object> value) {
    CatalogItem c = new CatalogItem();
    c.setValue(value);
    lenient()
        .when(catalogItemRepository.findByCategoryAndKeyAndLocale(any(), any(), Mockito.eq(locale)))
        .thenReturn(value == null ? Optional.empty() : Optional.of(c));
  }

  @Test
  void userLayerWinsOverFarmAndCatalog() {
    stubUser(Map.of("value", "user"));
    stubFarm(Map.of("value", "farm"));
    stubCatalog(null, Map.of("value", "catalog"));

    assertThat(service.resolve(1L, 2L, "cat", "k")).contains(Map.of("value", "user"));
  }

  @Test
  void farmLayerWinsOverCatalogWhenNoUser() {
    stubUser(null);
    stubFarm(Map.of("value", "farm"));
    stubCatalog(null, Map.of("value", "catalog"));

    assertThat(service.resolve(1L, 2L, "cat", "k")).contains(Map.of("value", "farm"));
  }

  @Test
  void catalogLocalizedThenUniversalFallback() {
    stubUser(null);
    stubFarm(null);
    // No localized 'fr' row, but a universal (null-locale) one exists.
    stubCatalog("fr", null);
    stubCatalog(null, Map.of("value", "universal"));

    assertThat(service.resolve(1L, 2L, "cat", "k")).contains(Map.of("value", "universal"));
  }

  @Test
  void emptyWhenNoLayerDefinesKey() {
    stubUser(null);
    stubFarm(null);
    stubCatalog("fr", null);
    stubCatalog(null, null);

    assertThat(service.resolve(1L, 2L, "cat", "k")).isEmpty();
  }

  @Test
  void resolveAsReturnsDefaultWhenAbsent() {
    stubUser(null);
    stubFarm(null);
    stubCatalog("fr", null);
    stubCatalog(null, null);

    String breed = service.resolveAs(1L, 2L, "breeds", "default_breed", String.class, "cobb_500");
    assertThat(breed).isEqualTo("cobb_500");
  }

  @Test
  void setFarmSetting_upsertsExistingRow() {
    FarmSetting existing = new FarmSetting();
    existing.setFarmId(2L);
    existing.setKey("currency");
    when(farmSettingRepository.findByFarmIdAndKey(2L, "currency"))
        .thenReturn(Optional.of(existing));
    when(farmSettingRepository.save(any(FarmSetting.class))).thenAnswer(i -> i.getArgument(0));

    FarmSetting saved = service.setFarmSetting(2L, "currency", Map.of("value", "EUR"));
    assertThat(saved.getValue()).containsEntry("value", "EUR");
  }
}
