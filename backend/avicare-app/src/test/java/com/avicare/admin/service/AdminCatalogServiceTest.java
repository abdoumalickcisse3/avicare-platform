package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.admin.dto.request.UpsertCatalogItemRequest;
import com.avicare.admin.dto.response.AdminCatalogCategory;
import com.avicare.admin.dto.response.AdminCatalogItemRow;
import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.parameters.domain.CatalogItem;
import com.avicare.parameters.repository.CatalogItemRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminCatalogServiceTest {

  @Mock CatalogItemRepository catalogItems;
  @Mock AdminAuditService auditService;

  @InjectMocks AdminCatalogService service;

  private CatalogItem item(Long id, String category, String key, Map<String, Object> value) {
    CatalogItem c = new CatalogItem();
    c.setId(id);
    c.setCategory(category);
    c.setKey(key);
    c.setValue(new LinkedHashMap<>(value));
    c.setActive(true);
    when(catalogItems.findById(id)).thenReturn(Optional.of(c));
    return c;
  }

  private UpsertCatalogItemRequest request(String category, String key, Map<String, Object> value) {
    return new UpsertCatalogItemRequest(category, key, null, value, true);
  }

  private CatalogItem saved() {
    ArgumentCaptor<CatalogItem> captor = ArgumentCaptor.captor();
    verify(catalogItems).save(captor.capture());
    return captor.getValue();
  }

  private Map<String, Object> auditMetadata() {
    ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.captor();
    verify(auditService).record(anyString(), anyString(), any(), any(), captor.capture());
    return captor.getValue();
  }

  // --- categories ----------------------------------------------------------

  private CatalogItemRepository.CategoryCount count(String category, long total, long active) {
    return new CatalogItemRepository.CategoryCount() {
      @Override
      public String getCategory() {
        return category;
      }

      @Override
      public long getTotal() {
        return total;
      }

      @Override
      public long getActiveCount() {
        return active;
      }
    };
  }

  @Test
  void marksThePlatformCategoriesAsReadOnly() {
    when(catalogItems.countByCategory())
        .thenReturn(List.of(count("breeds", 5, 5), count("modules", 16, 16)));

    List<AdminCatalogCategory> categories = service.categories();

    assertThat(categories)
        .extracting(AdminCatalogCategory::category, AdminCatalogCategory::editable)
        .containsExactly(
            org.assertj.core.api.Assertions.tuple("breeds", true),
            org.assertj.core.api.Assertions.tuple("modules", false));
  }

  // --- creating ------------------------------------------------------------

  @Test
  void createsAnEntryAndAuditsIt() {
    when(catalogItems.save(any()))
        .thenAnswer(
            inv -> {
              CatalogItem c = inv.getArgument(0);
              c.setId(42L);
              return c;
            });

    AdminCatalogItemRow row =
        service.create(
            request("breeds", "ross_308", Map.of("label", "Ross 308", "type", "broiler")));

    assertThat(saved().getKey()).isEqualTo("ross_308");
    assertThat(row.label()).isEqualTo("Ross 308");
    assertThat(row.editable()).isTrue();
    assertThat(auditMetadata()).containsEntry("key", "ross_308");
  }

  @Test
  void refusesAKeyThatAlreadyExists() {
    when(catalogItems.existsByCategoryAndKeyAndLocale("breeds", "cobb_500", null)).thenReturn(true);

    assertThatThrownBy(() -> service.create(request("breeds", "cobb_500", Map.of("label", "X"))))
        .isInstanceOf(ConflictException.class);
    verify(catalogItems, never()).save(any());
  }

  @Test
  void storesABlankLocaleAsNullSoTheUniversalRowStaysUnique() {
    when(catalogItems.save(any())).thenAnswer(inv -> inv.getArgument(0));

    service.create(
        new UpsertCatalogItemRequest("breeds", "ross_308", "  ", Map.of("label", "R"), true));

    // The partial unique index keys on locale IS NULL; an empty string would slip past it.
    assertThat(saved().getLocale()).isNull();
  }

  // --- read-only categories ------------------------------------------------

  @Test
  void refusesToWriteTheCategoriesThatDriveThePlatform() {
    item(7L, "modules", "module_broiler", Map.of("label", "Volaille chair"));

    // These decide what a farm can reach; a typo here is an outage nobody sees coming.
    assertThatThrownBy(() -> service.create(request("modules", "x", Map.of("label", "X"))))
        .isInstanceOf(BusinessRuleException.class)
        .hasMessageContaining("plateforme elle-même");
    assertThatThrownBy(() -> service.update(7L, request("modules", "x", Map.of("label", "X"))))
        .isInstanceOf(BusinessRuleException.class);
    verify(catalogItems, never()).save(any());
  }

  // --- updating ------------------------------------------------------------

  @Test
  void keepsThePreviousContentInTheAuditEntry() {
    CatalogItem existing =
        item(9L, "breeds", "cobb_500", Map.of("label", "Cobb 500", "type", "broiler"));

    service.update(9L, request("breeds", "cobb_500", Map.of("label", "Cobb 500 Plus")));

    assertThat(existing.getValue()).containsEntry("label", "Cobb 500 Plus");
    // Without the previous value the trail says something changed, not what.
    assertThat(auditMetadata())
        .containsEntry("previousValue", Map.of("label", "Cobb 500", "type", "broiler"));
  }

  @Test
  void deactivatesRatherThanDeletes() {
    CatalogItem existing = item(9L, "breeds", "cobb_500", Map.of("label", "Cobb 500"));

    service.update(
        9L,
        new UpsertCatalogItemRequest(
            "breeds", "cobb_500", null, Map.of("label", "Cobb 500"), false));

    // Flocks reference this by key with no foreign key to stop a delete; deactivation is the only
    // safe withdrawal.
    assertThat(existing.isActive()).isFalse();
    verify(catalogItems, never()).delete(any());
  }

  @Test
  void refusesAnEmptyOrMislabelledValue() {
    item(9L, "breeds", "cobb_500", Map.of("label", "Cobb 500"));

    assertThatThrownBy(() -> service.update(9L, request("breeds", "cobb_500", Map.of())))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("vide");
    // A numeric label would parse and store, then render as "42" in every screen.
    assertThatThrownBy(() -> service.update(9L, request("breeds", "cobb_500", Map.of("label", 42))))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("libellé");
  }

  @Test
  void acceptsACategoryThatCarriesNoLabel() {
    CatalogItem existing = item(9L, "egg_collection", "default_tray_size", Map.of("value", 30));

    // egg_collection stores a bare number; requiring a label would lock the category out.
    AdminCatalogItemRow row =
        service.update(9L, request("egg_collection", "default_tray_size", Map.of("value", 36)));

    assertThat(row.label()).isNull();
    assertThat(existing.getValue()).containsEntry("value", 36);
  }
}
