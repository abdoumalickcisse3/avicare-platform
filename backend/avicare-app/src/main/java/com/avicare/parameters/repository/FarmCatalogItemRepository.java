package com.avicare.parameters.repository;

import com.avicare.parameters.domain.FarmCatalogItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link FarmCatalogItem} (farm-level catalog overrides). */
public interface FarmCatalogItemRepository extends JpaRepository<FarmCatalogItem, Long> {

  List<FarmCatalogItem> findByFarmIdAndCategory(Long farmId, String category);

  Optional<FarmCatalogItem> findByFarmIdAndCategoryAndKey(Long farmId, String category, String key);
}
