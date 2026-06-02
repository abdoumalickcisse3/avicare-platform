package com.avicare.livestock.repository;

import com.avicare.livestock.domain.LifecycleEvent;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for {@link LifecycleEvent}. */
public interface LifecycleEventRepository extends JpaRepository<LifecycleEvent, Long> {

  List<LifecycleEvent> findByProductionUnitId(Long productionUnitId);

  List<LifecycleEvent> findByProductionUnitIdAndEventType(Long productionUnitId, String eventType);
}
