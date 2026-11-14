package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.admin.dto.request.UpsertCatalogItemRequest;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.BreedProfile;
import com.avicare.livestock.domain.Species;
import com.avicare.livestock.service.BreedWriteService;
import com.avicare.parameters.domain.CatalogItem;
import com.avicare.parameters.repository.CatalogItemRepository;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * Adding a breed from the console used to write a catalogue row and nothing else: the row existed,
 * no farm could select it, and the screen said otherwise. Writing {@code breeds} now materialises a
 * real platform breed — or refuses, when the entry does not say which family it belongs to.
 *
 * <p>A unit test rather than the integration test the plan sketched: the dedup against the database
 * is already covered by {@code BreedWriteServiceIT}, and what matters here is the decision made
 * before the write — which runs on any machine, Testcontainers or not.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminBreedMaterializationTest {

  @Mock private CatalogItemRepository catalogItems;
  @Mock private AdminAuditService auditService;
  @Mock private BreedWriteService breedWriteService;

  @InjectMocks private AdminCatalogService service;

  private static UpsertCatalogItemRequest entry(String category, Map<String, Object> value) {
    return new UpsertCatalogItemRequest(category, "goliath", null, value, true);
  }

  private void expectInsert() {
    when(catalogItems.existsByCategoryAndKeyAndLocale(anyString(), anyString(), any()))
        .thenReturn(false);
    when(catalogItems.save(any(CatalogItem.class)))
        .thenAnswer(
            invocation -> {
              CatalogItem item = invocation.getArgument(0);
              item.setId(1L);
              return item;
            });
    when(breedWriteService.declare(any(), any(), anyString(), any())).thenReturn(new Breed());
  }

  @Test
  @DisplayName("a breed added from the console becomes selectable by every farm")
  void consoleBreedIsMaterialised() {
    expectInsert();

    service.create(entry("breeds", Map.of("label", "Goliath", "profile", "BROILER_RUSTIC")));

    verify(breedWriteService)
        .declare(null, Species.POULTRY, "Goliath", BreedProfile.BROILER_RUSTIC);
  }

  @Test
  @DisplayName("an entry that does not say which family the breed belongs to is refused")
  void entryWithoutAProfileIsRefused() {
    expectInsert();

    assertThatThrownBy(() -> service.create(entry("breeds", Map.of("label", "Goliath"))))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("profil");

    verify(catalogItems, never()).save(any());
    verify(breedWriteService, never()).declare(any(), any(), anyString(), any());
  }

  @Test
  @DisplayName("a family nobody has heard of is refused rather than guessed")
  void unknownProfileIsRefused() {
    expectInsert();

    assertThatThrownBy(
            () ->
                service.create(
                    entry("breeds", Map.of("label", "Goliath", "profile", "SUPER_POULET"))))
        .isInstanceOf(ValidationException.class);

    verify(breedWriteService, never()).declare(any(), any(), anyString(), any());
  }

  @Test
  @DisplayName("every other catalogue category is left alone")
  void otherCategoriesNeverTouchBreeds() {
    expectInsert();

    service.create(entry("expense_categories", Map.of("label", "Transport")));

    verify(breedWriteService, never()).declare(any(), any(), anyString(), any());
  }

  @Test
  @DisplayName("correcting the entry re-materialises the breed, so a fixed label is not stranded")
  void updatingAnEntryMaterialisesToo() {
    CatalogItem existing = new CatalogItem();
    existing.setId(7L);
    existing.setCategory("breeds");
    existing.setKey("goliath");
    existing.setValue(
        new java.util.HashMap<>(Map.of("label", "Goliat", "profile", "BROILER_RUSTIC")));
    existing.setActive(true);
    when(catalogItems.findById(7L)).thenReturn(java.util.Optional.of(existing));
    when(breedWriteService.declare(any(), any(), anyString(), any())).thenReturn(new Breed());

    service.update(7L, entry("breeds", Map.of("label", "Goliath", "profile", "BROILER_RUSTIC")));

    verify(breedWriteService)
        .declare(null, Species.POULTRY, "Goliath", BreedProfile.BROILER_RUSTIC);
  }

  @Test
  @DisplayName("the console write is still audited")
  void theWriteIsAudited() {
    expectInsert();

    service.create(entry("breeds", Map.of("label", "Goliath", "profile", "BROILER_RUSTIC")));

    verify(auditService).record(anyString(), anyString(), any(), any(), any());
    assertThat(true).isTrue();
  }
}
