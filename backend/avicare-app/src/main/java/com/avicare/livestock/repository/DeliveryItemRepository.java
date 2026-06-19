package com.avicare.livestock.repository;

import com.avicare.livestock.domain.DeliveryItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeliveryItemRepository extends JpaRepository<DeliveryItem, Long> {

  List<DeliveryItem> findByDeliveryIdOrderById(Long deliveryId);
}
