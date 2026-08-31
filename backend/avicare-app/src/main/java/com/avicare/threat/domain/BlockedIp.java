package com.avicare.threat.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * An address the platform is currently refusing.
 *
 * <p>Always bounded. In Senegal a whole town can share one operator NAT, so an automatic block that
 * never lifts would eventually shut out a real farmer with nobody able to explain why. The block
 * buys time against a script; it is not a verdict.
 */
@Entity
@Table(name = "blocked_ips")
@Getter
@Setter
@NoArgsConstructor
public class BlockedIp {

  @Id
  @Column(name = "ip_address")
  private String ipAddress;

  @Column(name = "blocked_at", insertable = false, updatable = false)
  private LocalDateTime blockedAt;

  @Column(name = "blocked_until", nullable = false)
  private LocalDateTime blockedUntil;

  @Column(nullable = false)
  private String reason;

  /** {@code AUTO_BRUTEFORCE}, or the email of the staff member who blocked it by hand. */
  @Column(name = "blocked_by", nullable = false)
  private String blockedBy;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  public boolean isActive(LocalDateTime now) {
    return blockedUntil.isAfter(now);
  }
}
