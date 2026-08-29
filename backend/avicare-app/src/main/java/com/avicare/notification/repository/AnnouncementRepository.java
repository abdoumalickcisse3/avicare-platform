package com.avicare.notification.repository;

import com.avicare.notification.domain.Announcement;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Data access for {@link Announcement}. */
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

  List<Announcement> findAllByOrderByStartsAtDesc();

  /** What a farmer should see right now: published, started, not yet ended. */
  @Query(
      """
      SELECT a FROM Announcement a
      WHERE a.published = true
        AND a.startsAt <= :moment
        AND (a.endsAt IS NULL OR a.endsAt > :moment)
      ORDER BY a.severity DESC, a.startsAt DESC
      """)
  List<Announcement> findActive(@Param("moment") LocalDateTime moment);
}
