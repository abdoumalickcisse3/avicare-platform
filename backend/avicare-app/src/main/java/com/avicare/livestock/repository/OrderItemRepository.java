package com.avicare.livestock.repository;

import com.avicare.livestock.domain.OrderItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

  List<OrderItem> findByOrderIdOrderById(Long orderId);
}
