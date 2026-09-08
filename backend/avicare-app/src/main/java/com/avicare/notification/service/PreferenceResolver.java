package com.avicare.notification.service;

import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationChannel;
import com.avicare.notification.domain.NotificationPreference;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Resolves a user's delivery preference for a (category, channel), merging the code default with
 * the user's stored overrides (Sprint C1). Defaults live in code, never seeded in DB (3-layer
 * parameter rule), and a user can always override or switch a category off.
 *
 * <p><b>IN_APP</b> takes everything (min INFO): the bell is free, and the farmer opens it when he
 * chooses.
 *
 * <p><b>WHATSAPP</b> costs money and interrupts someone, so the floor is set <em>per category</em>
 * rather than globally. A single CRITICAL floor read as cost discipline but made six of the eight
 * categories unreachable: low stock — the first-ranked problem of fourteen of the seventeen farmers
 * surveyed — is a WARNING, so it never left the app. The line drawn here is not severity but
 * <em>where the person is</em>:
 *
 * <ul>
 *   <li><b>WARNING is enough</b> when the alert is about the flock or the feed, which are dealt
 *       with in a barn, away from a screen — running out of feed, a withdrawal period still
 *       running, a vaccine dose overdue.
 *   <li><b>CRITICAL only</b> for the office side — an overdue invoice, a client over their credit
 *       limit — where the manager is already looking at the dashboard, and a phone buzz adds
 *       nothing but noise and cost.
 * </ul>
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
        .orElseGet(() -> defaultFor(category, channel));
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

  private static ResolvedPreference defaultFor(
      NotificationCategory category, NotificationChannel channel) {
    return switch (channel) {
      case IN_APP -> new ResolvedPreference(true, NotificationSeverity.INFO);
      case WHATSAPP -> new ResolvedPreference(true, whatsappFloor(category));
    };
  }

  /** See the class comment: the field gets WARNING, the desk gets CRITICAL only. */
  private static NotificationSeverity whatsappFloor(NotificationCategory category) {
    return switch (category) {
      case MORTALITY_ANOMALY,
              CRITICAL_OBSERVATION,
              NEGATIVE_STOCK,
              LOW_STOCK,
              WITHDRAWAL_ENDING,
              VACCINATION_LATE ->
          NotificationSeverity.WARNING;
      case PO_OVERDUE, INVOICE_OVERDUE, CREDIT_EXCEEDED -> NotificationSeverity.CRITICAL;
    };
  }

  /** One resolved (category, channel) cell for the preferences grid API. */
  public record ResolvedCell(
      NotificationCategory category,
      NotificationChannel channel,
      boolean enabled,
      NotificationSeverity minSeverity) {}
}
