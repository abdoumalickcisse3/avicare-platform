package com.avicare.parameters.repository;

import com.avicare.parameters.domain.CatalogItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link CatalogItem} (layer 1 of the 3-layer lookup). */
public interface CatalogItemRepository extends JpaRepository<CatalogItem, Long> {

  Optional<CatalogItem> findByCategoryAndKeyAndLocale(String category, String key, String locale);

  List<CatalogItem> findByCategory(String category);
}
