package com.avicare.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

/**
 * Per-user read marker on a farm-scoped {@link Notification} (Sprint C1). A notification is visible
 * to every member of its farm; each user marks it read independently. "Unread" = no row for {@code
 * (notificationId, userId)}.
 */
@Entity
@Table(name = "notification_reads")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class NotificationRead {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "notification_id", nullable = false)
  private Long notificationId;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "read_at", insertable = false, updatable = false)
  private LocalDateTime readAt;
}
