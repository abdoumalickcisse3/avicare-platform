package com.avicare.livestock.repository;

import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.StockItem;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockItemRepository extends JpaRepository<StockItem, Long> {

  List<StockItem> findByFarmIdAndActiveTrueOrderByArticleKey(Long farmId);

  Optional<StockItem> findByFarmIdAndArticleSourceAndArticleKey(
      Long farmId, ArticleSource articleSource, String articleKey);

  Optional<StockItem> findByFarmIdAndId(Long farmId, Long id);

  /** Active stocks of a farm whose quantity has gone negative (Décision 19 fallout). */
  List<StockItem> findByFarmIdAndActiveTrueAndCurrentQuantityLessThanOrderByArticleKey(
      Long farmId, BigDecimal threshold);

  /**
   * Active stocks of a farm at or below their alert threshold. Derived queries can't express a
   * column-to-column comparison, hence JPQL.
   */
  @Query(
      "SELECT s FROM StockItem s WHERE s.farmId = :farmId AND s.active = true "
          + "AND s.alertThreshold IS NOT NULL AND s.currentQuantity <= s.alertThreshold "
          + "ORDER BY s.articleKey")
  List<StockItem> findLowStockByFarmId(@Param("farmId") Long farmId);
}
