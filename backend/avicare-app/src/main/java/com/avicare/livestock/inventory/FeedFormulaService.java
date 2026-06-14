package com.avicare.livestock.inventory;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.FeedFormula;
import com.avicare.livestock.domain.FeedPhase;
import com.avicare.livestock.domain.FormulaIngredient;
import com.avicare.livestock.repository.FeedFormulaRepository;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Feed formulas (Sprint B4-4): platform templates (read-only, catalog {@code feed_formulas}) plus
 * per-farm custom formulas a farmer creates from scratch or clones from a template. The estimated
 * cost per 100 kg is computed from current catalog prices ({@code typicalUnitPriceXof}); since an
 * ingredient's percentage is also its kilograms per 100 kg, {@code cost = Σ percentage × price}.
 *
 * <p>V1 scope (D20): a formula is a reference/costing aid — no formula→stock decomposition.
 * Ingredients are {@code INVENTORY}-sourced only (medicated mixes are a V2 idea). A total
 * percentage other than 100 is a non-blocking warning (the farmer may save a formula
 * mid-calibration). RBAC is enforced at the controller layer (B4-6).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FeedFormulaService {

  static final String CAT_FEED_FORMULAS = "feed_formulas";
  private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

  private final FeedFormulaRepository feedFormulaRepository;
  private final ParametersFacade parametersFacade;
  private final InventoryCatalogService inventoryCatalogService;

  // --- platform templates ---------------------------------------------

  @Transactional(readOnly = true)
  public List<PlatformFormulaDto> listPlatformFormulas() {
    Map<String, Integer> prices = priceByArticleKey();
    return parametersFacade.listPlatform(CAT_FEED_FORMULAS).stream()
        .map(e -> toPlatformDto(e, prices))
        .toList();
  }

  /** A single platform template by key (404 if unknown) — backs the catalog detail endpoint. */
  @Transactional(readOnly = true)
  public PlatformFormulaDto getPlatformFormula(String key) {
    return listPlatformFormulas().stream()
        .filter(p -> p.key().equals(key))
        .findFirst()
        .orElseThrow(() -> NotFoundException.of("PlatformFeedFormula", key));
  }

  @Transactional(readOnly = true)
  public List<FeedFormula> listFarmFormulas(Long farmId) {
    return feedFormulaRepository.findByFarmIdAndActiveTrueOrderByName(farmId);
  }

  @Transactional(readOnly = true)
  public AvailableFormulasResponse listAllAvailable(Long farmId) {
    return new AvailableFormulasResponse(listPlatformFormulas(), listFarmFormulas(farmId));
  }

  // --- farm formulas --------------------------------------------------

  @Transactional
  public FeedFormula createFromScratch(Long farmId, FeedFormulaCommand cmd, Long userId) {
    FeedFormula formula = new FeedFormula();
    formula.setFarmId(farmId);
    formula.setCreatedBy(userId);
    apply(formula, cmd);
    return feedFormulaRepository.save(formula);
  }

  @Transactional
  public FeedFormula cloneFromPlatform(
      Long farmId, String sourceFormulaKey, String newName, Long userId) {
    PlatformFormulaDto source =
        listPlatformFormulas().stream()
            .filter(p -> p.key().equals(sourceFormulaKey))
            .findFirst()
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "FEED_FORMULA_NOT_FOUND", "Unknown platform formula " + sourceFormulaKey));

    FeedFormula formula = new FeedFormula();
    formula.setFarmId(farmId);
    formula.setCreatedBy(userId);
    formula.setSourceFormulaKey(sourceFormulaKey);
    formula.setName(newName != null && !newName.isBlank() ? newName : "Clone de " + source.label());
    formula.setTargetBreedKeys(source.targetBreedKeys());
    formula.setTargetPhase(parsePhase(source.targetPhase()));
    formula.setTargetAgeDaysMin(source.targetAgeDaysMin());
    formula.setTargetAgeDaysMax(source.targetAgeDaysMax());
    formula.setIngredients(source.ingredients());
    applyComputed(formula);
    return feedFormulaRepository.save(formula);
  }

  @Transactional
  public FeedFormula update(Long farmId, Long formulaId, FeedFormulaCommand cmd, Long userId) {
    FeedFormula formula = load(farmId, formulaId);
    apply(formula, cmd);
    return formula;
  }

  /** Refresh the cost from current catalog prices (raw materials moved). */
  @Transactional
  public FeedFormula recomputeCost(Long farmId, Long formulaId, Long userId) {
    FeedFormula formula = load(farmId, formulaId);
    applyComputed(formula);
    return formula;
  }

  @Transactional
  public void deactivate(Long farmId, Long formulaId, Long userId) {
    FeedFormula formula = load(farmId, formulaId);
    formula.setActive(false);
  }

  @Transactional(readOnly = true)
  public FeedFormula get(Long farmId, Long formulaId) {
    return load(farmId, formulaId);
  }

  // --- internals ------------------------------------------------------

  private FeedFormula load(Long farmId, Long formulaId) {
    return feedFormulaRepository
        .findByFarmIdAndIdAndActiveTrue(farmId, formulaId)
        .orElseThrow(() -> NotFoundException.of("FeedFormula", formulaId));
  }

  private void apply(FeedFormula formula, FeedFormulaCommand cmd) {
    if (cmd.name() == null || cmd.name().isBlank()) {
      throw new ValidationException("FORMULA_NAME_REQUIRED", "A formula needs a name");
    }
    if (cmd.targetPhase() == null) {
      throw new ValidationException("FORMULA_PHASE_REQUIRED", "A formula needs a target phase");
    }
    validateIngredients(cmd.ingredients());
    formula.setName(cmd.name());
    formula.setDescription(cmd.description());
    formula.setTargetBreedKeys(cmd.targetBreedKeys() != null ? cmd.targetBreedKeys() : List.of());
    formula.setTargetPhase(cmd.targetPhase());
    formula.setTargetAgeDaysMin(cmd.targetAgeDaysMin());
    formula.setTargetAgeDaysMax(cmd.targetAgeDaysMax());
    formula.setIngredients(cmd.ingredients());
    formula.setNotes(cmd.notes());
    applyComputed(formula);
  }

  private void validateIngredients(List<FormulaIngredient> ingredients) {
    if (ingredients == null || ingredients.isEmpty()) {
      throw new ValidationException(
          "FORMULA_NO_INGREDIENTS", "A formula needs at least one ingredient");
    }
    List<String> inventoryKeys =
        inventoryCatalogService.listInventoryArticles().stream()
            .map(InventoryCatalogItemDto::articleKey)
            .toList();
    for (FormulaIngredient ingredient : ingredients) {
      if (ingredient.articleSource() != ArticleSource.INVENTORY) {
        throw new ValidationException(
            "FORMULA_INGREDIENT_SOURCE",
            "Only INVENTORY ingredients are supported in V1 (got "
                + ingredient.articleSource()
                + ")");
      }
      if (ingredient.percentage() == null
          || ingredient.percentage().signum() < 0
          || ingredient.percentage().compareTo(HUNDRED) > 0) {
        throw new ValidationException(
            "FORMULA_INGREDIENT_PERCENTAGE",
            "Each ingredient percentage must be between 0 and 100");
      }
      if (!inventoryKeys.contains(ingredient.articleKey())) {
        throw new NotFoundException(
            "ARTICLE_NOT_FOUND", "Unknown inventory article " + ingredient.articleKey());
      }
    }
  }

  /** Recompute total percentage + estimated cost from the formula's ingredients. */
  private void applyComputed(FeedFormula formula) {
    Map<String, Integer> prices = priceByArticleKey();
    BigDecimal total = BigDecimal.ZERO;
    BigDecimal cost = BigDecimal.ZERO;
    boolean missingPrice = false;
    for (FormulaIngredient ingredient : formula.getIngredients()) {
      total = total.add(ingredient.percentage());
      Integer price = prices.get(ingredient.articleKey());
      if (price == null) {
        missingPrice = true;
      } else {
        cost = cost.add(ingredient.percentage().multiply(BigDecimal.valueOf(price)));
      }
    }
    formula.setTotalPercentage(total);
    if (total.compareTo(HUNDRED) != 0) {
      log.warn(
          "Feed formula '{}' (farm {}) total percentage is {} (expected 100)",
          formula.getName(),
          formula.getFarmId(),
          total);
    }
    if (missingPrice) {
      log.warn(
          "Feed formula '{}' (farm {}) has ingredients without a catalog price; cost is partial",
          formula.getName(),
          formula.getFarmId());
    }
    formula.setEstimatedCostPer100kgXof(cost.setScale(0, RoundingMode.HALF_UP).intValueExact());
    formula.setEstimatedCostCalculatedAt(LocalDateTime.now());
  }

  private Map<String, Integer> priceByArticleKey() {
    Map<String, Integer> prices = new HashMap<>();
    for (InventoryCatalogItemDto dto : inventoryCatalogService.listAllAvailableArticles()) {
      if (dto.typicalUnitPriceXof() != null) {
        prices.put(dto.articleKey(), dto.typicalUnitPriceXof());
      }
    }
    return prices;
  }

  private PlatformFormulaDto toPlatformDto(CatalogEntryInfo e, Map<String, Integer> prices) {
    Map<String, Object> v = e.value();
    List<FormulaIngredient> ingredients = parseIngredients(v.get("ingredients"));
    BigDecimal cost = BigDecimal.ZERO;
    boolean missingPrice = false;
    for (FormulaIngredient ingredient : ingredients) {
      Integer price = prices.get(ingredient.articleKey());
      if (price == null) {
        missingPrice = true;
      } else {
        cost = cost.add(ingredient.percentage().multiply(BigDecimal.valueOf(price)));
      }
    }
    Integer estimatedCost =
        missingPrice ? null : cost.setScale(0, RoundingMode.HALF_UP).intValueExact();
    return new PlatformFormulaDto(
        e.key(),
        str(v, "label"),
        strList(v, "target_breed_keys"),
        str(v, "target_phase"),
        intg(v, "target_age_days_min"),
        intg(v, "target_age_days_max"),
        ingredients,
        estimatedCost);
  }

  private static List<FormulaIngredient> parseIngredients(Object raw) {
    List<FormulaIngredient> out = new ArrayList<>();
    if (raw instanceof List<?> list) {
      for (Object o : list) {
        if (o instanceof Map<?, ?> entry) {
          @SuppressWarnings("unchecked")
          Map<String, Object> m = (Map<String, Object>) entry;
          Object pct = m.get("percentage");
          BigDecimal percentage =
              pct instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : BigDecimal.ZERO;
          out.add(
              new FormulaIngredient(
                  String.valueOf(m.get("article_key")), ArticleSource.INVENTORY, percentage));
        }
      }
    }
    return out;
  }

  private static FeedPhase parsePhase(String phase) {
    try {
      return FeedPhase.valueOf(phase);
    } catch (IllegalArgumentException | NullPointerException ex) {
      return FeedPhase.OTHER;
    }
  }

  private static String str(Map<String, Object> v, String key) {
    Object o = v.get(key);
    return o != null ? o.toString() : null;
  }

  private static Integer intg(Map<String, Object> v, String key) {
    return v.get(key) instanceof Number n ? n.intValue() : null;
  }

  private static List<String> strList(Map<String, Object> v, String key) {
    return v.get(key) instanceof List<?> l ? l.stream().map(Object::toString).toList() : List.of();
  }
}
