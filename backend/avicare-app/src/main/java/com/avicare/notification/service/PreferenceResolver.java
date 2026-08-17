package com.avicare.notification.service;

import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationChannel;
import com.avicare.notification.domain.NotificationPreference;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Resolves a user's delivery preference for a (category, channel), merging the conservative code
 * default with the user's stored overrides (Sprint C1). Default: IN_APP on (min INFO), WHATSAPP off
 * (min CRITICAL). Defaults live in code, never seeded in DB (3-layer parameter rule).
 */
@Component
public class PreferenceResolver {

  /** Resolved cell of the preferences grid. */
  public record ResolvedPreference(boolean enabled, NotificationSeverity minSeverity) {}

  public ResolvedPreference resolve(
      NotificationCategory category,
      NotificationChannel channel,
      List<NotificationPreference> overrides) {
    return overrides.stream()
        .filter(p -> p.getCategory() == category && p.getChannel() == channel)
        .findFirst()
        .map(p -> new ResolvedPreference(p.isEnabled(), p.getMinSeverity()))
        .orElseGet(() -> defaultFor(channel));
  }

  /** The full grid (every category x channel), overrides merged over defaults. */
  public List<ResolvedCell> resolveAll(List<NotificationPreference> overrides) {
    List<ResolvedCell> cells = new ArrayList<>();
    for (NotificationCategory category : NotificationCategory.values()) {
      for (NotificationChannel channel : NotificationChannel.values()) {
        ResolvedPreference r = resolve(category, channel, overrides);
        cells.add(new ResolvedCell(category, channel, r.enabled(), r.minSeverity()));
      }
    }
    return cells;
  }

  private static ResolvedPreference defaultFor(NotificationChannel channel) {
    return switch (channel) {
      case IN_APP -> new ResolvedPreference(true, NotificationSeverity.INFO);
      case WHATSAPP -> new ResolvedPreference(false, NotificationSeverity.CRITICAL);
    };
  }

  /** One resolved (category, channel) cell for the preferences grid API. */
  public record ResolvedCell(
      NotificationCategory category,
      NotificationChannel channel,
      boolean enabled,
      NotificationSeverity minSeverity) {}
}
