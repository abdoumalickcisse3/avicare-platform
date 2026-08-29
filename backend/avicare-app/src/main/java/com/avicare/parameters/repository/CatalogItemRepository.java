package com.avicare.parameters.repository;

import com.avicare.parameters.domain.CatalogItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/** Data access for {@link CatalogItem} (layer 1 of the 3-layer lookup). */
public interface CatalogItemRepository extends JpaRepository<CatalogItem, Long> {

  Optional<CatalogItem> findByCategoryAndKeyAndLocale(String category, String key, String locale);

  List<CatalogItem> findByCategory(String category);

  List<CatalogItem> findByCategoryOrderByKeyAsc(String category);

  boolean existsByCategoryAndKeyAndLocale(String category, String key, String locale);

  /** One row per category with its counts — what the console's landing list needs. */
  @Query(
      """
      SELECT c.category AS category,
             COUNT(c) AS total,
             SUM(CASE WHEN c.active = true THEN 1L ELSE 0L END) AS activeCount
      FROM CatalogItem c
      GROUP BY c.category
      ORDER BY c.category
      """)
  List<CategoryCount> countByCategory();

  /** Projection for {@link #countByCategory()}. */
  interface CategoryCount {
    String getCategory();

    long getTotal();

    long getActiveCount();
  }
}
