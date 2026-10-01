package com.avicare.notification.push;

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
import lombok.ToString;

/**
 * A phone that can receive pushes: one Expo token, owned by one user (the phone follows the person,
 * not the farm). The token is unique — a phone handed to another account changes owner. {@code
 * revokedAt} marks a token Expo declared dead or one retired at logout; it is never used again
 * until the device registers itself afresh.
 */
@Entity
@Table(name = "push_devices")
@Getter
@Setter
@NoArgsConstructor
@ToString(exclude = "token")
public class PushDevice {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(nullable = false, unique = true, length = 200)
  private String token;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private PushPlatform platform;

  @Column(name = "last_seen_at", nullable = false)
  private LocalDateTime lastSeenAt = LocalDateTime.now();

  @Column(name = "revoked_at")
  private LocalDateTime revokedAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
