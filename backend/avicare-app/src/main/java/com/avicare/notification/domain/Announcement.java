package com.avicare.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A platform-wide message shown as a banner in the farmer app.
 *
 * <p>Timestamps are DB-owned (trigger). No soft delete: an announcement is unpublished or given an
 * end date, both of which say more than a {@code deleted_at} would.
 */
@Entity
@Table(name = "announcements")
@Getter
@Setter
@NoArgsConstructor
public class Announcement {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String title;

  @Column(nullable = false)
  private String body;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private NotificationSeverity severity = NotificationSeverity.INFO;

  @Column(name = "starts_at", nullable = false)
  private LocalDateTime startsAt = LocalDateTime.now();

  /** Null means no end. The console warns about it rather than forbidding it. */
  @Column(name = "ends_at")
  private LocalDateTime endsAt;

  @Column(nullable = false)
  private boolean published = false;

  @Column(name = "created_by")
  private Long createdBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  /** Live right now: published, started, and not yet ended. */
  public boolean isActiveAt(LocalDateTime moment) {
    return published && !startsAt.isAfter(moment) && (endsAt == null || endsAt.isAfter(moment));
  }
}
