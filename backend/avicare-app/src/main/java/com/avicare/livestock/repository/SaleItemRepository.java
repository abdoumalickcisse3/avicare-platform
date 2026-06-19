package com.avicare.livestock.repository;

import com.avicare.livestock.domain.SaleItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SaleItemRepository extends JpaRepository<SaleItem, Long> {

  List<SaleItem> findBySaleIdOrderById(Long saleId);
}
