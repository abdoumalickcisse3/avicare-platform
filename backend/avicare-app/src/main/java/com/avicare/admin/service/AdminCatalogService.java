package com.avicare.admin.service;

import com.avicare.admin.dto.request.UpsertCatalogItemRequest;
import com.avicare.admin.dto.response.AdminCatalogCategory;
import com.avicare.admin.dto.response.AdminCatalogItemRow;
import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ConflictException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.parameters.domain.CatalogItem;
import com.avicare.parameters.repository.CatalogItemRepository;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Editing {@code catalog_items} from the console, so a business addition stops being a migration.
 *
 * <p>Adding a breed or a vaccine used to mean writing a Flyway file and redeploying. It is platform
 * reference data, not schema, and it changes at the pace of the business.
 *
 * <p>Two rules hold the whole thing together:
 *
 * <ul>
 *   <li><b>Nothing is deleted, only deactivated.</b> Catalog entries are referenced by {@code key}
 *       from flocks, formulas and expenses. Removing a row would orphan the records that name it,
 *       and JSONB references carry no foreign key to stop it.
 *   <li><b>Some categories are read-only.</b> {@code modules} and {@code bundles} drive feature
 *       gating, {@code admin} carries the platform thresholds. A typo there silently changes what
 *       farms can reach — that is a deploy-reviewed change, not a console one.
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class AdminCatalogService {

  /**
   * Categories the console may read but never write. These are platform structure: {@code modules}
   * and {@code bundles} decide which features a farm gets, {@code admin} holds the health-score
   * thresholds the console itself reads.
   */
  static final Set<String> READ_ONLY_CATEGORIES = Set.of("modules", "bundles", "admin");

  private static final String LABEL = "label";

  private final CatalogItemRepository catalogItems;
  private final AdminAuditService auditService;

  @Transactional(readOnly = true)
  public List<AdminCatalogCategory> categories() {
    return catalogItems.countByCategory().stream()
        .map(
            c ->
                new AdminCatalogCategory(
                    c.getCategory(), c.getTotal(), c.getActiveCount(), isEditable(c.getCategory())))
        .toList();
  }

  @Transactional(readOnly = true)
  public List<AdminCatalogItemRow> itemsOf(String category) {
    return catalogItems.findByCategoryOrderByKeyAsc(category).stream()
        .map(AdminCatalogService::toRow)
        .toList();
  }

  @Transactional
  public AdminCatalogItemRow create(UpsertCatalogItemRequest request) {
    refuseReadOnly(request.category());
    Map<String, Object> value = validValue(request.value());
    String locale = normalizedLocale(request.locale());

    if (catalogItems.existsByCategoryAndKeyAndLocale(request.category(), request.key(), locale)) {
      throw new ConflictException(
          "CATALOG_KEY_TAKEN",
          "Une entrée existe déjà pour " + request.category() + " / " + request.key() + ".");
    }

    CatalogItem item = new CatalogItem();
    item.setCategory(request.category());
    item.setKey(request.key());
    item.setLocale(locale);
    item.setValue(value);
    item.setActive(request.active());
    CatalogItem saved = catalogItems.save(item);

    auditService.record(
        "catalog.item.create",
        "CatalogItem",
        saved.getId(),
        null,
        Map.of("category", saved.getCategory(), "key", saved.getKey()));
    return toRow(saved);
  }

  /**
   * Replace an entry's content. The category and key are immutable: they are how the rest of the
   * platform names this row, and renaming one would break every reference silently.
   */
  @Transactional
  public AdminCatalogItemRow update(Long id, UpsertCatalogItemRequest request) {
    CatalogItem item = load(id);
    refuseReadOnly(item.getCategory());
    Map<String, Object> value = validValue(request.value());

    Map<String, Object> previous = new LinkedHashMap<>(item.getValue());
    boolean wasActive = item.isActive();
    item.setValue(value);
    item.setActive(request.active());

    // The previous content is in the entry: a catalog change is exactly the kind you want to read
    // back as a diff months later.
    auditService.record(
        "catalog.item.update",
        "CatalogItem",
        id,
        null,
        Map.of(
            "category",
            item.getCategory(),
            "key",
            item.getKey(),
            "previousValue",
            previous,
            "previousActive",
            wasActive));
    return toRow(item);
  }

  private void refuseReadOnly(String category) {
    if (!isEditable(category)) {
      throw new BusinessRuleException(
          "CATALOG_CATEGORY_READ_ONLY",
          "La catégorie « "
              + category
              + " » pilote la plateforme elle-même et ne se modifie pas depuis la console.");
    }
  }

  private static boolean isEditable(String category) {
    return category != null && !READ_ONLY_CATEGORIES.contains(category);
  }

  /**
   * The stored value must be a JSON object. An array or a bare scalar would parse, store, and then
   * fail at every read site that expects a map.
   */
  private static Map<String, Object> validValue(Map<String, Object> value) {
    if (value == null || value.isEmpty()) {
      throw new ValidationException("CATALOG_VALUE_EMPTY", "Le contenu de l'entrée est vide.");
    }
    Object label = value.get(LABEL);
    if (label != null && (!(label instanceof String s) || s.isBlank())) {
      throw new ValidationException(
          "CATALOG_LABEL_INVALID", "Le libellé doit être un texte non vide.");
    }
    return new HashMap<>(value);
  }

  /** Blank and null mean the same thing — the universal row — and the DB index expects null. */
  private static String normalizedLocale(String locale) {
    return locale == null || locale.isBlank() ? null : locale.trim();
  }

  private CatalogItem load(Long id) {
    return catalogItems
        .findById(id)
        .orElseThrow(() -> new NotFoundException("CATALOG_ITEM_NOT_FOUND", "Entrée " + id));
  }

  private static AdminCatalogItemRow toRow(CatalogItem item) {
    Object label = item.getValue() == null ? null : item.getValue().get(LABEL);
    return new AdminCatalogItemRow(
        item.getId(),
        item.getCategory(),
        item.getKey(),
        item.getLocale(),
        label instanceof String s ? s : null,
        item.getValue(),
        item.isActive(),
        isEditable(item.getCategory()),
        item.getUpdatedAt());
  }
}
