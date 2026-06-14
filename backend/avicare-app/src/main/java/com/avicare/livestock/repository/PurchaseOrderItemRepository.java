package com.avicare.livestock.repository;

import com.avicare.livestock.domain.PurchaseOrderItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseOrderItemRepository extends JpaRepository<PurchaseOrderItem, Long> {

  List<PurchaseOrderItem> findByPurchaseOrderId(Long purchaseOrderId);
}
