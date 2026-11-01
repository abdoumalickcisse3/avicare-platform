package com.avicare.livestock.inventory;

import com.avicare.livestock.health.HealthCatalogService;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.subscription.api.SubscriptionFacade;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The medication bridge (ADR-020): a medication is <b>one</b> product with <b>two</b> faces, and
 * this service writes both at once.
 *
 * <ul>
 *   <li>the <b>stock article</b> — {@code inventory_items}, subcategory {@code MEDICATION} — what
 *       the farmer buys, receives and decrements against;
 *   <li>the <b>medical sheet</b> — {@code treatments} — molecule, routes and above all the
 *       withdrawal delays the treatment form needs to project a legal sale date.
 * </ul>
 *
 * <p>Both faces share the same {@code key}, and the <b>balance lives on the {@code INVENTORY} side
 * only</b>: {@code stock_items} is unique per {@code (farm, source, key)}, so a product carrying a
 * stock row on each side would hold two balances for one physical bottle — which is exactly how a
 * pilot farm ended up with {@code vigosine} at {@code TREATMENT=0} and {@code INVENTORY=0.97}.
 *
 * <p>Before this bridge the two catalogs could only be filled separately, and the form that records
 * a treatment reads the medical one: a medication declared in Stock was invisible to it, so farms
 * declared the same bottle twice under two spellings and treated against an entry holding no stock.
 */
@Service
@RequiredArgsConstructor
public class MedicationCatalogService {

  static final String CAT_INVENTORY_ITEMS = "inventory_items";
  static final String MEDICATION_SUBCATEGORY = "MEDICATION";
  private static final String MODULE_HEALTH_ADVANCED = "module.health.advanced";

  private final ParametersFacade parametersFacade;
  private final HealthCatalogService healthCatalogService;
  private final SubscriptionFacade subscriptionFacade;

  /**
   * Create or update a medication on both faces. The stock article always lands — it is the farm's
   * own data. The medical sheet lands only when the farm really holds {@code
   * module.health.advanced}: writing it regardless would make this route a side door onto a
   * module-gated catalog, and the returned {@code medicalSheetWritten} says which happened instead
   * of leaving the caller to assume.
   */
  @Transactional
  public MedicationDto save(Long farmId, MedicationCommand command) {
    parametersFacade.override(
        farmId, CAT_INVENTORY_ITEMS, command.key(), stockArticleValue(command));

    boolean advanced = subscriptionFacade.isModuleEnabled(farmId, MODULE_HEALTH_ADVANCED);
    if (advanced) {
      healthCatalogService.saveTreatment(farmId, command.key(), medicalSheetValue(command));
    }
    return new MedicationDto(
        command.key(),
        command.label(),
        command.unit(),
        command.typicalUnitPriceXof(),
        command.molecule(),
        command.routes(),
        command.withdrawalDaysMeat(),
        command.withdrawalDaysEggs(),
        advanced);
  }

  /** Hide a medication from both faces (a disable, like every other farm catalog removal). */
  @Transactional
  public void delete(Long farmId, String key) {
    parametersFacade.delete(farmId, CAT_INVENTORY_ITEMS, key);
    if (subscriptionFacade.isModuleEnabled(farmId, MODULE_HEALTH_ADVANCED)) {
      healthCatalogService.deleteTreatment(farmId, key);
    }
  }

  /** The stock face: what the article picker, purchase orders and movements read. */
  private static Map<String, Object> stockArticleValue(MedicationCommand command) {
    Map<String, Object> value = new LinkedHashMap<>();
    value.put("label", command.label());
    value.put("subcategory", MEDICATION_SUBCATEGORY);
    if (command.unit() != null && !command.unit().isBlank()) {
      value.put("unit", command.unit());
    }
    if (command.typicalUnitPriceXof() != null) {
      value.put("typical_unit_price_xof", command.typicalUnitPriceXof());
    }
    return value;
  }

  /** The medical face: what the treatment form reads to project the withdrawal. */
  private static Map<String, Object> medicalSheetValue(MedicationCommand command) {
    Map<String, Object> value = new LinkedHashMap<>();
    value.put("label", command.label());
    if (command.molecule() != null && !command.molecule().isBlank()) {
      value.put("molecule", command.molecule());
    }
    if (command.routes() != null && !command.routes().isEmpty()) {
      value.put("routes", command.routes());
    }
    if (command.withdrawalDaysMeat() != null) {
      value.put("withdrawal_days_meat", command.withdrawalDaysMeat());
    }
    if (command.withdrawalDaysEggs() != null) {
      value.put("withdrawal_days_eggs", command.withdrawalDaysEggs());
    }
    return value;
  }
}
