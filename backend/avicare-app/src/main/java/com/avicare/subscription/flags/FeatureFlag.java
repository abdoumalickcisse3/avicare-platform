package com.avicare.subscription.flags;

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

/**
 * A platform-wide switch for one module or mechanism.
 *
 * <p>Two switches, deliberately distinct. {@code enabledGlobally} is a standing decision — we do
 * not serve this yet. {@code killswitchActive} is an emergency: something is misbehaving right now,
 * and it must stop for every farm at once. The emergency one carries a reason, an author and an
 * expiry, because a cut nobody remembers to lift becomes an outage we inflicted on ourselves.
 */
@Entity
@Table(name = "feature_flags")
@Getter
@Setter
@NoArgsConstructor
public class FeatureFlag {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "flag_key", nullable = false, updatable = false)
  private String flagKey;

  @Column(name = "enabled_globally", nullable = false)
  private boolean enabledGlobally = true;

  @Column(name = "killswitch_active", nullable = false)
  private boolean killswitchActive = false;

  @Column(name = "killswitch_reason")
  private String killswitchReason;

  @Column(name = "killswitch_by")
  private Long killswitchBy;

  @Column(name = "killswitch_at")
  private LocalDateTime killswitchAt;

  @Column(name = "killswitch_expires_at")
  private LocalDateTime killswitchExpiresAt;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;

  /**
   * Whether this flag currently blocks its feature.
   *
   * <p>The expiry is honoured on read as well as by the sweep job: a cut whose window has passed
   * must stop blocking the moment it lapses, not whenever the next sweep happens to run.
   */
  public boolean blocking(LocalDateTime now) {
    if (!enabledGlobally) {
      return true;
    }
    return killswitchActive && (killswitchExpiresAt == null || killswitchExpiresAt.isAfter(now));
  }
}
