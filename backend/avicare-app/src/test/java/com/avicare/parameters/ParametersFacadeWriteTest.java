package com.avicare.parameters;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.parameters.api.dto.CatalogEntryInfo;
import com.avicare.parameters.domain.FarmCatalogItem;
import com.avicare.parameters.service.CatalogService;
import com.avicare.parameters.service.FarmSettingService;
import com.avicare.parameters.service.ParametersFacadeImpl;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ParametersFacadeWriteTest {

  @Mock FarmSettingService farmSettingService;
  @Mock CatalogService catalogService;

  @Test
  void overrideDelegatesAndMapsToCustomEntryInfo() {
    ParametersFacadeImpl facade = new ParametersFacadeImpl(farmSettingService, catalogService);
    Map<String, Object> value = Map.of("label", "Newcastle fermier");
    FarmCatalogItem item = new FarmCatalogItem();
    item.setCategory("vaccines");
    item.setKey("newcastle-fermier");
    item.setValue(value);
    // custom (no platform parent) → catalogItemId null → custom == true
    when(catalogService.override(7L, "vaccines", "newcastle-fermier", value)).thenReturn(item);

    CatalogEntryInfo out = facade.override(7L, "vaccines", "newcastle-fermier", value);

    assertThat(out.category()).isEqualTo("vaccines");
    assertThat(out.key()).isEqualTo("newcastle-fermier");
    assertThat(out.value()).isEqualTo(value);
    assertThat(out.custom()).isTrue();
  }

  @Test
  void deleteDelegatesToDisable() {
    ParametersFacadeImpl facade = new ParametersFacadeImpl(farmSettingService, catalogService);
    facade.delete(7L, "treatments", "amox-locale");
    verify(catalogService).disable(7L, "treatments", "amox-locale");
  }
}
