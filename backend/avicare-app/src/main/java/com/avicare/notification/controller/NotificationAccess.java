package com.avicare.notification.controller;

/**
 * Shared {@code @PreAuthorize} SpEL for the notification endpoints (Sprint C1). Notifications are a
 * transverse feature — every member of the farm sees their own bell and manages their own read
 * state / preferences — so access is gated on farm membership ({@code hasAccess}) rather than a
 * dedicated {@code resource:verb} permission. This also avoids breaking existing members whose
 * stored permissions predate this feature. No {@code module.*} gate (notifications are not sold as
 * a module).
 */
final class NotificationAccess {

  private NotificationAccess() {}

  static final String ACCESS = "@farmAccess.hasAccess(#farmId)";
}
