package com.avicare.parameters.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.parameters.domain.PriceList;
import com.avicare.parameters.domain.PriceListItem;
import com.avicare.parameters.repository.PriceListItemRepository;
import com.avicare.parameters.repository.PriceListRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages a farm's price lists and their priced items. Lists are soft-deletable (the entity's
 * {@code @SQLRestriction} hides deleted rows). At most one list per farm is the default: marking a
 * new one default clears the previous default.
 */
@Service
@RequiredArgsConstructor
public class PriceListService {

  private final PriceListRepository priceListRepository;
  private final PriceListItemRepository priceListItemRepository;

  @Transactional
  public PriceList create(
      Long farmId, String name, boolean isDefault, LocalDate validFrom, LocalDate validTo) {
    if (isDefault) {
      clearCurrentDefault(farmId);
    }
    PriceList list = new PriceList();
    list.setFarmId(farmId);
    list.setName(name);
    list.setDefaultList(isDefault);
    list.setValidFrom(validFrom);
    list.setValidTo(validTo);
    return priceListRepository.save(list);
  }

  @Transactional(readOnly = true)
  public List<PriceList> listForFarm(Long farmId) {
    return priceListRepository.findByFarmId(farmId);
  }

  @Transactional(readOnly = true)
  public Optional<PriceList> getDefault(Long farmId) {
    return priceListRepository.findByFarmIdAndDefaultListTrue(farmId);
  }

  /** Soft delete (via {@code @SQLDelete} on the entity). */
  @Transactional
  public void delete(Long priceListId) {
    priceListRepository.delete(loadList(priceListId));
  }

  /** Upsert an item by (priceList, productKey). */
  @Transactional
  public PriceListItem upsertItem(
      Long priceListId, String productKey, BigDecimal unitPrice, String currency) {
    loadList(priceListId); // ensure the (non-deleted) list exists
    PriceListItem item =
        priceListItemRepository
            .findByPriceListIdAndProductKey(priceListId, productKey)
            .orElseGet(PriceListItem::new);
    item.setPriceListId(priceListId);
    item.setProductKey(productKey);
    item.setUnitPrice(unitPrice);
    if (currency != null && !currency.isBlank()) {
      item.setCurrency(currency);
    }
    return priceListItemRepository.save(item);
  }

  @Transactional(readOnly = true)
  public List<PriceListItem> listItems(Long priceListId) {
    return priceListItemRepository.findByPriceListId(priceListId);
  }

  @Transactional
  public void removeItem(Long priceListId, String productKey) {
    PriceListItem item =
        priceListItemRepository
            .findByPriceListIdAndProductKey(priceListId, productKey)
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "PRICE_LIST_ITEM_NOT_FOUND",
                        "No item " + productKey + " in price list " + priceListId));
    priceListItemRepository.delete(item);
  }

  private void clearCurrentDefault(Long farmId) {
    priceListRepository
        .findByFarmIdAndDefaultListTrue(farmId)
        .ifPresent(current -> current.setDefaultList(false));
  }

  private PriceList loadList(Long priceListId) {
    return priceListRepository
        .findById(priceListId)
        .orElseThrow(() -> NotFoundException.of("PriceList", priceListId));
  }
}
