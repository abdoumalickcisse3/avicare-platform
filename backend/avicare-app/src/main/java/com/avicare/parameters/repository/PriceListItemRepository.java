package com.avicare.parameters.repository;

import com.avicare.parameters.domain.PriceListItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link PriceListItem}. */
public interface PriceListItemRepository extends JpaRepository<PriceListItem, Long> {

  List<PriceListItem> findByPriceListId(Long priceListId);

  Optional<PriceListItem> findByPriceListIdAndProductKey(Long priceListId, String productKey);
}
