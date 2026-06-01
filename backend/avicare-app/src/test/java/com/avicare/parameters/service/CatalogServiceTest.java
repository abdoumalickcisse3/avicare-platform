package com.avicare.parameters.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.parameters.domain.CatalogItem;
import com.avicare.parameters.domain.FarmCatalogItem;
import com.avicare.parameters.repository.CatalogItemRepository;
import com.avicare.parameters.repository.FarmCatalogItemRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for the catalog merge logic in {@link CatalogService} (repos mocked). */
class CatalogServiceTest {

  private CatalogItemRepository catalogItemRepository;
  private FarmCatalogItemRepository farmCatalogItemRepository;
  private CatalogService service;

  @BeforeEach
  void setUp() {
    catalogItemRepository = Mockito.mock(CatalogItemRepository.class);
    farmCatalogItemRepository = Mockito.mock(FarmCatalogItemRepository.class);
    service = new CatalogService(catalogItemRepository, farmCatalogItemRepository);
  }

  private CatalogItem platform(String key, String label) {
    CatalogItem c = new CatalogItem();
    c.setCategory("breeds");
    c.setKey(key);
    c.setValue(Map.of("label", label));
    c.setActive(true);
    return c;
  }

  private FarmCatalogItem farmItem(String key, String label, boolean disabled, Long parentId) {
    FarmCatalogItem f = new FarmCatalogItem();
    f.setCategory("breeds");
    f.setKey(key);
    f.setValue(Map.of("label", label));
    f.setDisabled(disabled);
    f.setCatalogItemId(parentId);
    return f;
  }

  @Test
  void listForFarm_mergesOverridesAdditionsAndDisables() {
    when(catalogItemRepository.findByCategory("breeds"))
        .thenReturn(List.of(platform("cobb_500", "Cobb 500"), platform("ross_308", "Ross 308")));
    when(farmCatalogItemRepository.findByFarmIdAndCategory(7L, "breeds"))
        .thenReturn(
            List.of(
                farmItem("cobb_500", "Mes Cobb 500", false, 1L), // override
                farmItem("ross_308", "", true, 2L), // disable
                farmItem("local_breed", "Ma souche locale", false, null))); // custom add

    List<CatalogEntry> entries = service.listForFarm(7L, "breeds");

    assertThat(entries).hasSize(2);
    assertThat(entries)
        .anySatisfy(
            e -> {
              assertThat(e.key()).isEqualTo("cobb_500");
              assertThat(e.value()).containsEntry("label", "Mes Cobb 500");
              assertThat(e.custom()).isFalse();
            })
        .anySatisfy(
            e -> {
              assertThat(e.key()).isEqualTo("local_breed");
              assertThat(e.custom()).isTrue();
            });
    assertThat(entries).noneMatch(e -> e.key().equals("ross_308"));
  }

  @Test
  void override_linksToPlatformParentWhenExists() {
    when(farmCatalogItemRepository.findByFarmIdAndCategoryAndKey(7L, "breeds", "cobb_500"))
        .thenReturn(java.util.Optional.empty());
    CatalogItem parent = platform("cobb_500", "Cobb 500");
    parent.setId(42L);
    when(catalogItemRepository.findByCategoryAndKeyAndLocale("breeds", "cobb_500", null))
        .thenReturn(java.util.Optional.of(parent));
    when(farmCatalogItemRepository.save(Mockito.any(FarmCatalogItem.class)))
        .thenAnswer(i -> i.getArgument(0));

    FarmCatalogItem saved = service.override(7L, "breeds", "cobb_500", Map.of("label", "X"));
    assertThat(saved.getCatalogItemId()).isEqualTo(42L);
    assertThat(saved.isDisabled()).isFalse();
  }
}
